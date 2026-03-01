
CREATE TABLE public.cases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_name text NOT NULL,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL
);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on cases" ON public.cases FOR SELECT USING (true);
CREATE POLICY "Allow all insert on cases" ON public.cases FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on cases" ON public.cases FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on cases" ON public.cases FOR DELETE USING (true);
