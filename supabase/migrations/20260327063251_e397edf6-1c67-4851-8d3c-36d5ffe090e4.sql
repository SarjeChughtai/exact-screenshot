-- Clean up overlapping INSERT policies on user_roles to prevent privilege escalation

DROP POLICY IF EXISTS "Only admins and owners can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage non-owner roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can manage owner role" ON public.user_roles;

-- Owners can do everything
CREATE POLICY "Owners full access"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

-- Admins can manage non-owner roles only
CREATE POLICY "Admins manage non-owner roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND role <> 'owner'::app_role)
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND role <> 'owner'::app_role);