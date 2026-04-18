-- ============================================================
-- Migration 008: Live Group Sessions
-- ============================================================

-- ============================================================
-- 1. Group Sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.group_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  max_participants INTEGER NOT NULL DEFAULT 30 CHECK (max_participants > 0),
  price_aed NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price_aed >= 0),
  is_free BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  daily_room_name TEXT,
  daily_room_url TEXT,
  recording_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Session Registrations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.session_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_status TEXT NOT NULL DEFAULT 'free'
    CHECK (payment_status IN ('free', 'pending', 'paid')),
  stripe_session_id TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_registrations_unique_user_session UNIQUE (session_id, user_id)
);

-- ============================================================
-- 3. Updated-at trigger (reuse pattern from courses migration)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_group_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_group_sessions_updated_at
  BEFORE UPDATE ON public.group_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_group_sessions_updated_at();

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_group_sessions_doctor_id ON public.group_sessions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_group_sessions_status ON public.group_sessions(status);
CREATE INDEX IF NOT EXISTS idx_group_sessions_scheduled_at ON public.group_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_group_sessions_is_published ON public.group_sessions(is_published);
CREATE INDEX IF NOT EXISTS idx_session_registrations_session_id ON public.session_registrations(session_id);
CREATE INDEX IF NOT EXISTS idx_session_registrations_user_id ON public.session_registrations(user_id);

-- ============================================================
-- 5. Row Level Security
-- ============================================================
ALTER TABLE public.group_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_registrations ENABLE ROW LEVEL SECURITY;

-- group_sessions: anyone can read published sessions
CREATE POLICY "group_sessions_public_read"
  ON public.group_sessions FOR SELECT
  USING (is_published = TRUE);

-- group_sessions: doctor can read their own (including drafts)
CREATE POLICY "group_sessions_doctor_read_own"
  ON public.group_sessions FOR SELECT
  USING (doctor_id = public.get_doctor_id_for_user(auth.uid()));

-- group_sessions: doctor can insert sessions linked to themselves
CREATE POLICY "group_sessions_doctor_insert"
  ON public.group_sessions FOR INSERT
  WITH CHECK (public.get_doctor_id_for_user(auth.uid()) IS NOT NULL);

-- group_sessions: doctor can update their own sessions
CREATE POLICY "group_sessions_doctor_update_own"
  ON public.group_sessions FOR UPDATE
  USING (doctor_id = public.get_doctor_id_for_user(auth.uid()));

-- group_sessions: doctor can delete their own sessions
CREATE POLICY "group_sessions_doctor_delete_own"
  ON public.group_sessions FOR DELETE
  USING (doctor_id = public.get_doctor_id_for_user(auth.uid()));

-- session_registrations: users can view their own registrations
CREATE POLICY "session_registrations_owner_select"
  ON public.session_registrations FOR SELECT
  USING (auth.uid() = user_id);

-- session_registrations: users can register themselves
CREATE POLICY "session_registrations_owner_insert"
  ON public.session_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- session_registrations: users can update their own registrations (e.g. payment status via API)
CREATE POLICY "session_registrations_owner_update"
  ON public.session_registrations FOR UPDATE
  USING (auth.uid() = user_id);

-- session_registrations: users can delete (unregister) their own
CREATE POLICY "session_registrations_owner_delete"
  ON public.session_registrations FOR DELETE
  USING (auth.uid() = user_id);
