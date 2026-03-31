CREATE OR REPLACE FUNCTION public.get_user_directory(user_ids uuid[] DEFAULT NULL)
RETURNS TABLE(id uuid, email text, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest_requests AS (
    SELECT DISTINCT ON (ar.user_id)
      ar.user_id,
      COALESCE(ar.email, '') AS email,
      COALESCE(ar.name, '') AS name
    FROM public.access_requests ar
    ORDER BY ar.user_id, ar.created_at DESC
  ),
  latest_identities AS (
    SELECT DISTINCT ON (ai.user_id)
      ai.user_id,
      COALESCE(ai.identity_data->>'email', '') AS email,
      COALESCE(
        ai.identity_data->>'full_name',
        ai.identity_data->>'name',
        ''
      ) AS display_name
    FROM auth.identities ai
    ORDER BY ai.user_id, ai.created_at DESC
  ),
  scoped_users AS (
    SELECT ur.user_id AS id
    FROM public.user_roles ur
    WHERE user_ids IS NULL OR ur.user_id = ANY(user_ids)
    UNION
    SELECT up.user_id AS id
    FROM public.user_profiles up
    WHERE user_ids IS NULL OR up.user_id = ANY(user_ids)
    UNION
    SELECT lr.user_id AS id
    FROM latest_requests lr
    WHERE user_ids IS NULL OR lr.user_id = ANY(user_ids)
    UNION
    SELECT li.user_id AS id
    FROM latest_identities li
    WHERE user_ids IS NULL OR li.user_id = ANY(user_ids)
    UNION
    SELECT au.id
    FROM auth.users au
    WHERE user_ids IS NOT NULL AND au.id = ANY(user_ids)
  )
  SELECT
    su.id,
    COALESCE(
      NULLIF(up.contact_email, ''),
      NULLIF(au.email, ''),
      NULLIF(li.email, ''),
      NULLIF(lr.email, ''),
      ''
    ) AS email,
    COALESCE(
      CASE
        WHEN public.is_placeholder_display_name(up.display_name) THEN NULL
        ELSE NULLIF(up.display_name, '')
      END,
      CASE
        WHEN public.is_placeholder_display_name(au.raw_user_meta_data->>'full_name') THEN NULL
        ELSE NULLIF(au.raw_user_meta_data->>'full_name', '')
      END,
      CASE
        WHEN public.is_placeholder_display_name(au.raw_user_meta_data->>'name') THEN NULL
        ELSE NULLIF(au.raw_user_meta_data->>'name', '')
      END,
      CASE
        WHEN public.is_placeholder_display_name(li.display_name) THEN NULL
        ELSE NULLIF(li.display_name, '')
      END,
      NULLIF(lr.name, ''),
      split_part(COALESCE(NULLIF(up.contact_email, ''), NULLIF(au.email, ''), NULLIF(li.email, ''), NULLIF(lr.email, ''), ''), '@', 1),
      ''
    ) AS display_name
  FROM scoped_users su
  LEFT JOIN auth.users au ON au.id = su.id
  LEFT JOIN public.user_profiles up ON up.user_id = su.id
  LEFT JOIN latest_requests lr ON lr.user_id = su.id
  LEFT JOIN latest_identities li ON li.user_id = su.id;
$$;

INSERT INTO public.app_settings (key, value)
VALUES ('manual_personnel', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.user_profiles (user_id, display_name, contact_email, updated_at)
SELECT
  directory.id,
  directory.display_name,
  directory.email,
  now()
FROM public.get_user_directory() directory
WHERE directory.id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET display_name = CASE
      WHEN public.is_placeholder_display_name(public.user_profiles.display_name)
        OR public.user_profiles.display_name = ''
      THEN EXCLUDED.display_name
      ELSE public.user_profiles.display_name
    END,
    contact_email = CASE
      WHEN public.user_profiles.contact_email = ''
      THEN EXCLUDED.contact_email
      ELSE public.user_profiles.contact_email
    END,
    updated_at = now();
