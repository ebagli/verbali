
-- Create transcriptions table
CREATE TABLE public.transcriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  conversation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transcript_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT DEFAULT ''
);

-- Create problematic_cases table
CREATE TABLE public.problematic_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transcription_id UUID NOT NULL REFERENCES public.transcriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  resolved BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problematic_cases ENABLE ROW LEVEL SECURITY;

-- Helper function for problematic_cases access
CREATE OR REPLACE FUNCTION public.user_owns_transcription(t_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transcriptions
    WHERE id = t_id AND user_id = auth.uid()
  );
$$;

-- Transcriptions RLS policies
CREATE POLICY "Users can view own transcriptions"
  ON public.transcriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own transcriptions"
  ON public.transcriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own transcriptions"
  ON public.transcriptions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own transcriptions"
  ON public.transcriptions FOR DELETE
  USING (user_id = auth.uid());

-- Problematic cases RLS policies
CREATE POLICY "Users can view own problematic cases"
  ON public.problematic_cases FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own problematic cases"
  ON public.problematic_cases FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.user_owns_transcription(transcription_id));

CREATE POLICY "Users can update own problematic cases"
  ON public.problematic_cases FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own problematic cases"
  ON public.problematic_cases FOR DELETE
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_transcriptions_user_id ON public.transcriptions(user_id);
CREATE INDEX idx_transcriptions_conversation_date ON public.transcriptions(conversation_date);
CREATE INDEX idx_problematic_cases_transcription_id ON public.problematic_cases(transcription_id);
CREATE INDEX idx_problematic_cases_user_id ON public.problematic_cases(user_id);
