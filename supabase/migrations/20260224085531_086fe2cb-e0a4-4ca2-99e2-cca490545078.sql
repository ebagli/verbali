
ALTER TABLE public.authorized_users
ADD COLUMN password text NOT NULL DEFAULT '';
