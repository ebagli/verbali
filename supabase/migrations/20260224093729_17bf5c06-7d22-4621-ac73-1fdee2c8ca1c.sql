
-- 1. Rename password column to password_hash for clarity
ALTER TABLE public.authorized_users RENAME COLUMN password TO password_hash;

-- 2. Drop the SELECT policy that exposes password data to clients
DROP POLICY IF EXISTS "Users can check own authorization" ON public.authorized_users;

-- 3. Revoke direct SELECT on authorized_users from anon/authenticated roles
REVOKE SELECT ON public.authorized_users FROM anon, authenticated;
