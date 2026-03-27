-- Function to get display info (email, name) for users from auth.users
-- This is needed because the client cannot query auth.users directly.
-- Only callable by admins/owners for user management purposes.
CREATE OR REPLACE FUNCTION public.get_user_display_info(user_ids uuid[])
RETURNS TABLE(id uuid, email text, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins/owners to call this function
  IF NOT has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.email, '') AS email,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      ''
    ) AS display_name
  FROM auth.users u
  WHERE u.id = ANY(user_ids);
END;
$$;
