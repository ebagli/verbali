
-- Fix 1: Change user_owns_transcription to SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.user_owns_transcription(t_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transcriptions
    WHERE id = t_id AND user_id = auth.uid()
  );
$$;

-- Fix 2: Restrict authorized_users SELECT to only the user's own email
DROP POLICY IF EXISTS "Authorized users can view authorized list" ON public.authorized_users;
CREATE POLICY "Users can check own authorization"
ON public.authorized_users
FOR SELECT
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);
