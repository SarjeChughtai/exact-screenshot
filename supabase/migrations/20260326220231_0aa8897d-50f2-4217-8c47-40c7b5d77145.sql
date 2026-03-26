
-- Fix deals: remove permissive policies
DROP POLICY IF EXISTS "Allow authenticated read" ON public.deals;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.deals;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.deals;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.deals;

-- Fix admin privilege escalation: restrict USING to exclude owner rows
DROP POLICY IF EXISTS "Admins can manage non-owner roles" ON public.user_roles;
CREATE POLICY "Admins can manage non-owner roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND role != 'owner')
WITH CHECK (public.has_role(auth.uid(), 'admin') AND role != 'owner');
