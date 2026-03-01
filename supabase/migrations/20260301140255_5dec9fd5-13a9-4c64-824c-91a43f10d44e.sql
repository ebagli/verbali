
-- Drop permissive policies on transcriptions
DROP POLICY IF EXISTS "Allow all select on transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "Allow all insert on transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "Allow all update on transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "Allow all delete on transcriptions" ON public.transcriptions;

-- Restore user-scoped policies on transcriptions
CREATE POLICY "Users can view own transcriptions"
  ON public.transcriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own transcriptions"
  ON public.transcriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own transcriptions"
  ON public.transcriptions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own transcriptions"
  ON public.transcriptions FOR DELETE
  USING (user_id = auth.uid());

-- Drop permissive policies on speakers
DROP POLICY IF EXISTS "Allow all select on speakers" ON public.speakers;
DROP POLICY IF EXISTS "Allow all insert on speakers" ON public.speakers;
DROP POLICY IF EXISTS "Allow all update on speakers" ON public.speakers;
DROP POLICY IF EXISTS "Allow all delete on speakers" ON public.speakers;

-- Restore user-scoped policies on speakers
CREATE POLICY "Users can view own speakers"
  ON public.speakers FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own speakers"
  ON public.speakers FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own speakers"
  ON public.speakers FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own speakers"
  ON public.speakers FOR DELETE
  USING (user_id = auth.uid());

-- Drop permissive policies on cases
DROP POLICY IF EXISTS "Allow all select on cases" ON public.cases;
DROP POLICY IF EXISTS "Allow all insert on cases" ON public.cases;
DROP POLICY IF EXISTS "Allow all update on cases" ON public.cases;
DROP POLICY IF EXISTS "Allow all delete on cases" ON public.cases;

-- Restore user-scoped policies on cases
CREATE POLICY "Users can view own cases"
  ON public.cases FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own cases"
  ON public.cases FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own cases"
  ON public.cases FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own cases"
  ON public.cases FOR DELETE
  USING (user_id = auth.uid());

-- Drop permissive policies on problematic_cases
DROP POLICY IF EXISTS "Allow all select on problematic_cases" ON public.problematic_cases;
DROP POLICY IF EXISTS "Allow all insert on problematic_cases" ON public.problematic_cases;
DROP POLICY IF EXISTS "Allow all update on problematic_cases" ON public.problematic_cases;
DROP POLICY IF EXISTS "Allow all delete on problematic_cases" ON public.problematic_cases;

-- Restore user-scoped policies on problematic_cases
CREATE POLICY "Users can view own problematic_cases"
  ON public.problematic_cases FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own problematic_cases"
  ON public.problematic_cases FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own problematic_cases"
  ON public.problematic_cases FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own problematic_cases"
  ON public.problematic_cases FOR DELETE
  USING (user_id = auth.uid());
