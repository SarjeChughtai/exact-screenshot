-- Table for users to request specific roles
CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  requested_role app_role NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests
CREATE POLICY "Users can read own requests"
  ON public.access_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can insert own requests"
  ON public.access_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins/owners can read all requests
CREATE POLICY "Admins can read all requests"
  ON public.access_requests FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));

-- Admins/owners can update requests (approve/deny)
CREATE POLICY "Admins can update requests"
  ON public.access_requests FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));

-- Allow admins to read ALL user_roles for user management
CREATE POLICY "Admins can read all user_roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));