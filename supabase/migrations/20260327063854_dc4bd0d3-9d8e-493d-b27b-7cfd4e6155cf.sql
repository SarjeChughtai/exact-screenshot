
DROP POLICY IF EXISTS "Admins manage non-owner roles" ON public.user_roles;

CREATE POLICY "Admins manage non-owner roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND role NOT IN ('owner'::app_role, 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND role NOT IN ('owner'::app_role, 'admin'::app_role));
