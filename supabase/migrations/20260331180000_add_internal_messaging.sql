ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS can_use_messaging boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

INSERT INTO public.user_profiles (user_id, can_use_messaging, updated_at)
SELECT DISTINCT ur.user_id, true, now()
FROM public.user_roles ur
WHERE ur.role IN ('admin', 'owner', 'accounting', 'operations', 'sales_rep', 'estimator')
ON CONFLICT (user_id) DO UPDATE
SET can_use_messaging = true,
    updated_at = now();

CREATE TABLE IF NOT EXISTS public.messaging_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('direct', 'group', 'team', 'deal')),
  title text NOT NULL DEFAULT '',
  job_id text,
  team_key text,
  direct_key text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.messaging_conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.messaging_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  is_admin boolean NOT NULL DEFAULT false,
  notifications_muted boolean NOT NULL DEFAULT false,
  membership_source text NOT NULL DEFAULT 'manual'
    CHECK (membership_source IN ('manual', 'direct', 'auto_team', 'auto_deal')),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messaging_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.messaging_conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS messaging_conversations_direct_key_unique
  ON public.messaging_conversations(direct_key)
  WHERE kind = 'direct' AND direct_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS messaging_conversations_team_key_unique
  ON public.messaging_conversations(team_key)
  WHERE kind = 'team' AND team_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS messaging_conversations_job_id_unique
  ON public.messaging_conversations(job_id)
  WHERE kind = 'deal' AND job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS messaging_conversations_kind_idx
  ON public.messaging_conversations(kind, last_message_at DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS messaging_conversation_members_user_idx
  ON public.messaging_conversation_members(user_id, conversation_id);

CREATE INDEX IF NOT EXISTS messaging_messages_conversation_idx
  ON public.messaging_messages(conversation_id, created_at DESC);

ALTER TABLE public.messaging_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_use_messaging(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id = _user_id
      AND up.can_use_messaging = true
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_messaging_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(COALESCE(value, ''), '\s+', ' ', 'g')));
$$;

CREATE OR REPLACE FUNCTION public.make_direct_key(user_a uuid, user_b uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN user_a::text < user_b::text THEN user_a::text || ':' || user_b::text
    ELSE user_b::text || ':' || user_a::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_messaging_conversation_member(
  _conversation_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.messaging_conversation_members m
    WHERE m.conversation_id = _conversation_id
      AND m.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_messaging_conversation(
  _conversation_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.messaging_conversation_members m
    WHERE m.conversation_id = _conversation_id
      AND m.user_id = _user_id
      AND m.is_admin = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.messaging_conversations c
    WHERE c.id = _conversation_id
      AND c.created_by = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_messaging_directory()
RETURNS TABLE(
  id uuid,
  email text,
  display_name text,
  roles public.app_role[],
  can_use_messaging boolean,
  last_seen_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    directory.id,
    directory.email,
    directory.display_name,
    COALESCE(
      ARRAY(
        SELECT DISTINCT ur.role
        FROM public.user_roles ur
        WHERE ur.user_id = directory.id
        ORDER BY ur.role
      ),
      ARRAY[]::public.app_role[]
    ) AS roles,
    COALESCE(up.can_use_messaging, false) AS can_use_messaging,
    up.last_seen_at
  FROM public.get_user_directory(NULL) directory
  LEFT JOIN public.user_profiles up ON up.user_id = directory.id
  WHERE COALESCE(up.can_use_messaging, false) = true;
$$;

CREATE OR REPLACE FUNCTION public.ensure_direct_conversation(_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  conversation_id uuid;
  _direct_key text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _other_user_id IS NULL OR _other_user_id = current_user_id THEN
    RAISE EXCEPTION 'A second user is required';
  END IF;

  IF NOT public.can_use_messaging(current_user_id) OR NOT public.can_use_messaging(_other_user_id) THEN
    RAISE EXCEPTION 'Both users must have messaging enabled';
  END IF;

  _direct_key := public.make_direct_key(current_user_id, _other_user_id);

  INSERT INTO public.messaging_conversations (kind, title, direct_key, created_by, last_message_at)
  VALUES ('direct', '', _direct_key, current_user_id, now())
  ON CONFLICT (direct_key) WHERE kind = 'direct' AND direct_key IS NOT NULL
  DO UPDATE SET updated_at = now()
  RETURNING id INTO conversation_id;

  IF conversation_id IS NULL THEN
    SELECT c.id INTO conversation_id
    FROM public.messaging_conversations c
    WHERE c.kind = 'direct' AND c.direct_key = _direct_key
    LIMIT 1;
  END IF;

  INSERT INTO public.messaging_conversation_members (conversation_id, user_id, is_admin, membership_source, joined_at)
  VALUES
    (conversation_id, current_user_id, false, 'direct', now()),
    (conversation_id, _other_user_id, false, 'direct', now())
  ON CONFLICT (conversation_id, user_id) DO UPDATE
  SET membership_source = 'direct';

  RETURN conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_team_conversation(_team_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  conversation_id uuid;
  conversation_title text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.can_use_messaging(current_user_id) THEN
    RAISE EXCEPTION 'Messaging is not enabled for this user';
  END IF;

  conversation_title := CASE _team_key
    WHEN 'leadership' THEN 'Leadership'
    WHEN 'sales' THEN 'Sales'
    WHEN 'operations' THEN 'Operations'
    WHEN 'estimating' THEN 'Estimating'
    WHEN 'accounting' THEN 'Accounting'
    WHEN 'freight' THEN 'Freight'
    ELSE NULL
  END;

  IF conversation_title IS NULL THEN
    RAISE EXCEPTION 'Invalid team key';
  END IF;

  INSERT INTO public.messaging_conversations (kind, title, team_key, created_by, last_message_at)
  VALUES ('team', conversation_title, _team_key, current_user_id, now())
  ON CONFLICT (team_key) WHERE kind = 'team' AND team_key IS NOT NULL
  DO UPDATE SET title = EXCLUDED.title, updated_at = now()
  RETURNING id INTO conversation_id;

  IF conversation_id IS NULL THEN
    SELECT c.id INTO conversation_id
    FROM public.messaging_conversations c
    WHERE c.kind = 'team' AND c.team_key = _team_key
    LIMIT 1;
  END IF;

  DELETE FROM public.messaging_conversation_members
  WHERE public.messaging_conversation_members.conversation_id = conversation_id
    AND membership_source = 'auto_team'
    AND user_id NOT IN (
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      JOIN public.user_profiles up ON up.user_id = ur.user_id
      WHERE up.can_use_messaging = true
        AND (
          (_team_key = 'leadership' AND ur.role IN ('admin', 'owner'))
          OR (_team_key = 'sales' AND ur.role = 'sales_rep')
          OR (_team_key = 'operations' AND ur.role = 'operations')
          OR (_team_key = 'estimating' AND ur.role = 'estimator')
          OR (_team_key = 'accounting' AND ur.role = 'accounting')
          OR (_team_key = 'freight' AND ur.role = 'freight')
        )
    );

  INSERT INTO public.messaging_conversation_members (conversation_id, user_id, joined_at, membership_source, is_admin)
  SELECT
    conversation_id,
    ur.user_id,
    now(),
    'auto_team',
    ur.user_id = current_user_id
  FROM public.user_roles ur
  JOIN public.user_profiles up ON up.user_id = ur.user_id
  WHERE up.can_use_messaging = true
    AND (
      (_team_key = 'leadership' AND ur.role IN ('admin', 'owner'))
      OR (_team_key = 'sales' AND ur.role = 'sales_rep')
      OR (_team_key = 'operations' AND ur.role = 'operations')
      OR (_team_key = 'estimating' AND ur.role = 'estimator')
      OR (_team_key = 'accounting' AND ur.role = 'accounting')
      OR (_team_key = 'freight' AND ur.role = 'freight')
    )
  ON CONFLICT (conversation_id, user_id) DO UPDATE
  SET membership_source = 'auto_team',
      is_admin = public.messaging_conversation_members.is_admin OR EXCLUDED.is_admin;

  RETURN conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_deal_conversation_members(_job_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  conversation_id uuid;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.can_use_messaging(current_user_id) THEN
    RAISE EXCEPTION 'Messaging is not enabled for this user';
  END IF;

  INSERT INTO public.messaging_conversations (kind, title, job_id, created_by, last_message_at)
  VALUES ('deal', 'Deal ' || COALESCE(_job_id, ''), _job_id, current_user_id, now())
  ON CONFLICT (job_id) WHERE kind = 'deal' AND job_id IS NOT NULL
  DO UPDATE SET title = EXCLUDED.title, updated_at = now()
  RETURNING id INTO conversation_id;

  IF conversation_id IS NULL THEN
    SELECT c.id INTO conversation_id
    FROM public.messaging_conversations c
    WHERE c.kind = 'deal' AND c.job_id = _job_id
    LIMIT 1;
  END IF;

  WITH directory AS (
    SELECT *
    FROM public.get_messaging_directory()
  ),
  named_members AS (
    SELECT DISTINCT d.id AS user_id
    FROM public.deals deal
    JOIN directory d
      ON public.normalize_messaging_name(d.display_name) = public.normalize_messaging_name(deal.sales_rep)
      OR public.normalize_messaging_name(d.display_name) = public.normalize_messaging_name(deal.estimator)
      OR public.normalize_messaging_name(d.display_name) = public.normalize_messaging_name(deal.team_lead)
    WHERE deal.job_id = _job_id
  ),
  assigned_members AS (
    SELECT DISTINCT q.assigned_estimator_user_id AS user_id
    FROM public.quotes q
    JOIN public.user_profiles up ON up.user_id = q.assigned_estimator_user_id
    WHERE q.job_id = _job_id
      AND q.assigned_estimator_user_id IS NOT NULL
      AND up.can_use_messaging = true
    UNION
    SELECT DISTINCT q.assigned_operations_user_id AS user_id
    FROM public.quotes q
    JOIN public.user_profiles up ON up.user_id = q.assigned_operations_user_id
    WHERE q.job_id = _job_id
      AND q.assigned_operations_user_id IS NOT NULL
      AND up.can_use_messaging = true
    UNION
    SELECT DISTINCT f.assigned_freight_user_id AS user_id
    FROM public.freight f
    JOIN public.user_profiles up ON up.user_id = f.assigned_freight_user_id
    WHERE f.job_id = _job_id
      AND f.assigned_freight_user_id IS NOT NULL
      AND up.can_use_messaging = true
  ),
  desired_members AS (
    SELECT user_id FROM named_members
    UNION
    SELECT user_id FROM assigned_members
    UNION
    SELECT current_user_id
  )
  DELETE FROM public.messaging_conversation_members
  WHERE public.messaging_conversation_members.conversation_id = conversation_id
    AND membership_source = 'auto_deal'
    AND user_id NOT IN (SELECT user_id FROM desired_members);

  WITH directory AS (
    SELECT *
    FROM public.get_messaging_directory()
  ),
  named_members AS (
    SELECT DISTINCT d.id AS user_id
    FROM public.deals deal
    JOIN directory d
      ON public.normalize_messaging_name(d.display_name) = public.normalize_messaging_name(deal.sales_rep)
      OR public.normalize_messaging_name(d.display_name) = public.normalize_messaging_name(deal.estimator)
      OR public.normalize_messaging_name(d.display_name) = public.normalize_messaging_name(deal.team_lead)
    WHERE deal.job_id = _job_id
  ),
  assigned_members AS (
    SELECT DISTINCT q.assigned_estimator_user_id AS user_id
    FROM public.quotes q
    JOIN public.user_profiles up ON up.user_id = q.assigned_estimator_user_id
    WHERE q.job_id = _job_id
      AND q.assigned_estimator_user_id IS NOT NULL
      AND up.can_use_messaging = true
    UNION
    SELECT DISTINCT q.assigned_operations_user_id AS user_id
    FROM public.quotes q
    JOIN public.user_profiles up ON up.user_id = q.assigned_operations_user_id
    WHERE q.job_id = _job_id
      AND q.assigned_operations_user_id IS NOT NULL
      AND up.can_use_messaging = true
    UNION
    SELECT DISTINCT f.assigned_freight_user_id AS user_id
    FROM public.freight f
    JOIN public.user_profiles up ON up.user_id = f.assigned_freight_user_id
    WHERE f.job_id = _job_id
      AND f.assigned_freight_user_id IS NOT NULL
      AND up.can_use_messaging = true
  ),
  desired_members AS (
    SELECT user_id FROM named_members
    UNION
    SELECT user_id FROM assigned_members
    UNION
    SELECT current_user_id
  )
  INSERT INTO public.messaging_conversation_members (
    conversation_id,
    user_id,
    joined_at,
    membership_source,
    is_admin
  )
  SELECT
    conversation_id,
    dm.user_id,
    now(),
    'auto_deal',
    dm.user_id = current_user_id
  FROM desired_members dm
  ON CONFLICT (conversation_id, user_id) DO UPDATE
  SET membership_source = CASE
        WHEN public.messaging_conversation_members.membership_source = 'manual' THEN 'manual'
        ELSE 'auto_deal'
      END,
      is_admin = public.messaging_conversation_members.is_admin OR EXCLUDED.is_admin;

  RETURN conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_deal_conversation(_job_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.sync_deal_conversation_members(_job_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_messaging_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messaging_conversations
  SET last_message_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_messaging_conversation ON public.messaging_messages;
CREATE TRIGGER trg_touch_messaging_conversation
AFTER INSERT ON public.messaging_messages
FOR EACH ROW
EXECUTE FUNCTION public.touch_messaging_conversation();

DROP POLICY IF EXISTS "Messaging conversations select" ON public.messaging_conversations;
CREATE POLICY "Messaging conversations select"
  ON public.messaging_conversations FOR SELECT TO authenticated
  USING (
    public.can_use_messaging(auth.uid())
    AND public.is_messaging_conversation_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "Messaging conversations insert" ON public.messaging_conversations;
CREATE POLICY "Messaging conversations insert"
  ON public.messaging_conversations FOR INSERT TO authenticated
  WITH CHECK (
    public.can_use_messaging(auth.uid())
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Messaging conversations update" ON public.messaging_conversations;
CREATE POLICY "Messaging conversations update"
  ON public.messaging_conversations FOR UPDATE TO authenticated
  USING (
    public.can_use_messaging(auth.uid())
    AND public.is_messaging_conversation_member(id, auth.uid())
  )
  WITH CHECK (
    public.can_use_messaging(auth.uid())
    AND public.is_messaging_conversation_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "Messaging conversations delete" ON public.messaging_conversations;
CREATE POLICY "Messaging conversations delete"
  ON public.messaging_conversations FOR DELETE TO authenticated
  USING (
    public.can_use_messaging(auth.uid())
    AND public.can_manage_messaging_conversation(id, auth.uid())
  );

DROP POLICY IF EXISTS "Messaging members select" ON public.messaging_conversation_members;
CREATE POLICY "Messaging members select"
  ON public.messaging_conversation_members FOR SELECT TO authenticated
  USING (
    public.can_use_messaging(auth.uid())
    AND public.is_messaging_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Messaging members insert" ON public.messaging_conversation_members;
CREATE POLICY "Messaging members insert"
  ON public.messaging_conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    public.can_use_messaging(auth.uid())
    AND (
      user_id = auth.uid()
      OR public.can_manage_messaging_conversation(conversation_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Messaging members update" ON public.messaging_conversation_members;
CREATE POLICY "Messaging members update"
  ON public.messaging_conversation_members FOR UPDATE TO authenticated
  USING (
    public.can_use_messaging(auth.uid())
    AND (
      user_id = auth.uid()
      OR public.can_manage_messaging_conversation(conversation_id, auth.uid())
    )
  )
  WITH CHECK (
    public.can_use_messaging(auth.uid())
    AND (
      user_id = auth.uid()
      OR public.can_manage_messaging_conversation(conversation_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Messaging members delete" ON public.messaging_conversation_members;
CREATE POLICY "Messaging members delete"
  ON public.messaging_conversation_members FOR DELETE TO authenticated
  USING (
    public.can_use_messaging(auth.uid())
    AND (
      user_id = auth.uid()
      OR public.can_manage_messaging_conversation(conversation_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Messaging messages select" ON public.messaging_messages;
CREATE POLICY "Messaging messages select"
  ON public.messaging_messages FOR SELECT TO authenticated
  USING (
    public.can_use_messaging(auth.uid())
    AND public.is_messaging_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Messaging messages insert" ON public.messaging_messages;
CREATE POLICY "Messaging messages insert"
  ON public.messaging_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.can_use_messaging(auth.uid())
    AND sender_user_id = auth.uid()
    AND public.is_messaging_conversation_member(conversation_id, auth.uid())
    AND COALESCE(body, '') <> ''
  );

DROP POLICY IF EXISTS "Messaging messages update" ON public.messaging_messages;
CREATE POLICY "Messaging messages update"
  ON public.messaging_messages FOR UPDATE TO authenticated
  USING (
    public.can_use_messaging(auth.uid())
    AND sender_user_id = auth.uid()
    AND public.is_messaging_conversation_member(conversation_id, auth.uid())
  )
  WITH CHECK (
    public.can_use_messaging(auth.uid())
    AND sender_user_id = auth.uid()
    AND public.is_messaging_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Messaging messages delete" ON public.messaging_messages;
CREATE POLICY "Messaging messages delete"
  ON public.messaging_messages FOR DELETE TO authenticated
  USING (
    public.can_use_messaging(auth.uid())
    AND sender_user_id = auth.uid()
    AND public.is_messaging_conversation_member(conversation_id, auth.uid())
  );

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messaging_conversations;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messaging_conversation_members;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messaging_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
