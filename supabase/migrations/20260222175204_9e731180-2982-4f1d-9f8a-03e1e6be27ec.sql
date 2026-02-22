
-- Speakers table for mapping ElevenLabs labels to real names
CREATE TABLE public.speakers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own speakers" ON public.speakers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create own speakers" ON public.speakers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own speakers" ON public.speakers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own speakers" ON public.speakers FOR DELETE USING (user_id = auth.uid());

-- Add report_html column to transcriptions for storing generated reports
ALTER TABLE public.transcriptions ADD COLUMN report_html TEXT DEFAULT '';

-- Add speaker_mapping column to transcriptions for storing label->speaker_id mapping
ALTER TABLE public.transcriptions ADD COLUMN speaker_mapping JSONB DEFAULT '{}'::jsonb;
