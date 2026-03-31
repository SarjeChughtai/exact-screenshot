-- Fix: Remove auto-assignment of sales_rep role on new user creation.
-- New users should start with NO roles and require admin approval.

-- Replace handle_new_user() to do nothing (no default role assignment)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Intentionally do NOT assign any role.
  -- New users must be approved by an admin via the Settings page.
  RETURN NEW;
END;
$$;
-- Helper: check if a user has at least one assigned role (i.e., is approved)
CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;
