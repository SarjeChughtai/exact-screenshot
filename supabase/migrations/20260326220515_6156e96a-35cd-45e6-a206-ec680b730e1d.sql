
-- Fix quotes: remove permissive policies
DROP POLICY IF EXISTS "Allow authenticated read" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.quotes;

-- Fix user_roles: prevent unprivileged users from inserting roles
-- Add explicit INSERT policy that only allows admin/owner to insert
CREATE POLICY "Only admins and owners can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role])
);
