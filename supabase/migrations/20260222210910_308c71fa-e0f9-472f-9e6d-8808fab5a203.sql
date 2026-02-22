
-- Create authorized_users table
CREATE TABLE public.authorized_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.authorized_users ENABLE ROW LEVEL SECURITY;

-- Only authenticated users whose email is in the table can read it
CREATE POLICY "Authorized users can view authorized list"
ON public.authorized_users
FOR SELECT
TO authenticated
USING (true);

-- Security definer function to check if a user email is authorized
CREATE OR REPLACE FUNCTION public.is_authorized_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.authorized_users au
    JOIN auth.users u ON u.email = au.email
    WHERE u.id = _user_id
  );
$$;

-- Update RLS policies on transcriptions to also require authorized email
DROP POLICY IF EXISTS "Users can view own transcriptions" ON public.transcriptions;
CREATE POLICY "Users can view own transcriptions"
ON public.transcriptions FOR SELECT
USING (user_id = auth.uid() AND public.is_authorized_user(auth.uid()));

DROP POLICY IF EXISTS "Users can create own transcriptions" ON public.transcriptions;
CREATE POLICY "Users can create own transcriptions"
ON public.transcriptions FOR INSERT
WITH CHECK (user_id = auth.uid() AND public.is_authorized_user(auth.uid()));

DROP POLICY IF EXISTS "Users can update own transcriptions" ON public.transcriptions;
CREATE POLICY "Users can update own transcriptions"
ON public.transcriptions FOR UPDATE
USING (user_id = auth.uid() AND public.is_authorized_user(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own transcriptions" ON public.transcriptions;
CREATE POLICY "Users can delete own transcriptions"
ON public.transcriptions FOR DELETE
USING (user_id = auth.uid() AND public.is_authorized_user(auth.uid()));

-- Update RLS policies on speakers
DROP POLICY IF EXISTS "Users can view own speakers" ON public.speakers;
CREATE POLICY "Users can view own speakers"
ON public.speakers FOR SELECT
USING (user_id = auth.uid() AND public.is_authorized_user(auth.uid()));

DROP POLICY IF EXISTS "Users can create own speakers" ON public.speakers;
CREATE POLICY "Users can create own speakers"
ON public.speakers FOR INSERT
WITH CHECK (user_id = auth.uid() AND public.is_authorized_user(auth.uid()));

DROP POLICY IF EXISTS "Users can update own speakers" ON public.speakers;
CREATE POLICY "Users can update own speakers"
ON public.speakers FOR UPDATE
USING (user_id = auth.uid() AND public.is_authorized_user(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own speakers" ON public.speakers;
CREATE POLICY "Users can delete own speakers"
ON public.speakers FOR DELETE
USING (user_id = auth.uid() AND public.is_authorized_user(auth.uid()));

-- Update RLS policies on problematic_cases
DROP POLICY IF EXISTS "Users can view own problematic cases" ON public.problematic_cases;
CREATE POLICY "Users can view own problematic cases"
ON public.problematic_cases FOR SELECT
USING (user_id = auth.uid() AND public.is_authorized_user(auth.uid()));

DROP POLICY IF EXISTS "Users can create own problematic cases" ON public.problematic_cases;
CREATE POLICY "Users can create own problematic cases"
ON public.problematic_cases FOR INSERT
WITH CHECK (user_id = auth.uid() AND public.is_authorized_user(auth.uid()) AND user_owns_transcription(transcription_id));

DROP POLICY IF EXISTS "Users can update own problematic cases" ON public.problematic_cases;
CREATE POLICY "Users can update own problematic cases"
ON public.problematic_cases FOR UPDATE
USING (user_id = auth.uid() AND public.is_authorized_user(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own problematic cases" ON public.problematic_cases;
CREATE POLICY "Users can delete own problematic cases"
ON public.problematic_cases FOR DELETE
USING (user_id = auth.uid() AND public.is_authorized_user(auth.uid()));
