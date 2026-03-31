CREATE OR REPLACE FUNCTION public.get_personnel_display_info(user_ids uuid[])
RETURNS TABLE(id uuid, email text, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.email, '') AS email,
    COALESCE(
      NULLIF(u.raw_user_meta_data->>'full_name', ''),
      NULLIF(u.raw_user_meta_data->>'name', ''),
      NULLIF(ar.name, ''),
      split_part(COALESCE(u.email, ''), '@', 1)
    ) AS display_name
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT access_requests.name
    FROM public.access_requests
    WHERE access_requests.user_id = u.id
    ORDER BY access_requests.created_at DESC
    LIMIT 1
  ) ar ON true
  WHERE u.id = ANY(user_ids)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = u.id
        AND ur.role IN ('sales_rep'::app_role, 'estimator'::app_role)
    );
END;
$$;
