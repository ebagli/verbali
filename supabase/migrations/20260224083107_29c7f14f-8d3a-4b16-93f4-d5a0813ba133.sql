
CREATE OR REPLACE FUNCTION public.user_owns_transcription(t_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transcriptions
    WHERE id = t_id AND user_id = auth.uid()
  );
$$;
