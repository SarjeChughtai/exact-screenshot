-- Add name column to access_requests so Google sign-ups can store display name
ALTER TABLE public.access_requests ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
DO $$ BEGIN
  CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Users can update (mark as read) their own notifications
DO $$ BEGIN
  CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Authenticated users can insert notifications (app inserts on behalf of others; trigger also inserts)
DO $$ BEGIN
  CREATE POLICY "Authenticated can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Users can delete their own notifications
DO $$ BEGIN
  CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Trigger function: notify all admin/owner users when a new access request is submitted
CREATE OR REPLACE FUNCTION public.notify_admins_on_access_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display_name text;
BEGIN
  display_name := CASE WHEN NEW.name <> '' THEN NEW.name ELSE NEW.email END;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT ur.user_id,
    'New Access Request',
    display_name || ' has requested ' || NEW.requested_role || ' access.',
    'info',
    '/settings'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'owner');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_access_request_insert ON public.access_requests;
CREATE TRIGGER on_access_request_insert
AFTER INSERT ON public.access_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_on_access_request();;
