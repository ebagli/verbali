
DROP POLICY IF EXISTS "Users can check own authorization" ON public.authorized_users;
CREATE POLICY "Users can check own authorization"
ON public.authorized_users
FOR SELECT
TO authenticated
USING (
  email = (auth.jwt() ->> 'email')
);
