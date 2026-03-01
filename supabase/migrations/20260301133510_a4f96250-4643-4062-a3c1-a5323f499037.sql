
-- Drop restrictive RLS policies and replace with permissive ones (no auth required)

-- Transcriptions
DROP POLICY IF EXISTS "Users can view own transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "Users can create own transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "Users can update own transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "Users can delete own transcriptions" ON public.transcriptions;

CREATE POLICY "Allow all select on transcriptions" ON public.transcriptions FOR SELECT USING (true);
CREATE POLICY "Allow all insert on transcriptions" ON public.transcriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on transcriptions" ON public.transcriptions FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on transcriptions" ON public.transcriptions FOR DELETE USING (true);

-- Speakers
DROP POLICY IF EXISTS "Users can view own speakers" ON public.speakers;
DROP POLICY IF EXISTS "Users can create own speakers" ON public.speakers;
DROP POLICY IF EXISTS "Users can update own speakers" ON public.speakers;
DROP POLICY IF EXISTS "Users can delete own speakers" ON public.speakers;

CREATE POLICY "Allow all select on speakers" ON public.speakers FOR SELECT USING (true);
CREATE POLICY "Allow all insert on speakers" ON public.speakers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on speakers" ON public.speakers FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on speakers" ON public.speakers FOR DELETE USING (true);

-- Problematic Cases
DROP POLICY IF EXISTS "Users can view own problematic cases" ON public.problematic_cases;
DROP POLICY IF EXISTS "Users can create own problematic cases" ON public.problematic_cases;
DROP POLICY IF EXISTS "Users can update own problematic cases" ON public.problematic_cases;
DROP POLICY IF EXISTS "Users can delete own problematic cases" ON public.problematic_cases;

CREATE POLICY "Allow all select on problematic_cases" ON public.problematic_cases FOR SELECT USING (true);
CREATE POLICY "Allow all insert on problematic_cases" ON public.problematic_cases FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on problematic_cases" ON public.problematic_cases FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on problematic_cases" ON public.problematic_cases FOR DELETE USING (true);
