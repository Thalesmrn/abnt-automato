
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- TCC table
CREATE TABLE public.tccs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  theme TEXT NOT NULL,
  author_name TEXT,
  institution TEXT,
  course TEXT,
  advisor TEXT,
  city TEXT,
  year INT,
  size TEXT NOT NULL DEFAULT 'medio', -- curto | medio | longo
  status TEXT NOT NULL DEFAULT 'pending', -- pending | generating | done | error
  progress INT NOT NULL DEFAULT 0,
  content JSONB, -- structured TCC content
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tccs_user ON public.tccs(user_id, created_at DESC);

ALTER TABLE public.tccs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tccs" ON public.tccs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tccs" ON public.tccs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tccs" ON public.tccs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own tccs" ON public.tccs FOR DELETE USING (auth.uid() = user_id);
