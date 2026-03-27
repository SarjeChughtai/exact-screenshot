-- Defensively remove any trigger/function that auto-assigns a default role
-- (e.g. sales_rep) to newly created auth.users rows.
--
-- A common Supabase starter pattern is:
--   CREATE FUNCTION public.handle_new_user() ...
--     INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'sales_rep');
--   CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users ...
--
-- Such a trigger bypasses the access-request approval flow and causes every new
-- Google OAuth sign-up (and email sign-up) to land with an unintended role.
-- Using IF EXISTS makes this migration safe even if the objects never existed.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
