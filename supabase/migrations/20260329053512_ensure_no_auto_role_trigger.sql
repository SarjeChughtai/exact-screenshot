-- Ensure no database trigger auto-assigns a role to new auth.users rows.
-- This prevents Google OAuth sign-ins from bypassing the access-request approval
-- flow. New users must wait for an admin to approve their access_request before
-- any role is added to user_roles and they can enter the portal.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
