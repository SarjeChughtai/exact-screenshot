
-- Drop the overly broad admin policy
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Admins can manage non-owner roles
CREATE POLICY "Admins can manage non-owner roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND role != 'owner');

-- Only owners can assign the owner role
CREATE POLICY "Owners can manage owner role" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
