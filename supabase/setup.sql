-- ============================================================================
-- CABSSA Clubdesk — Complete Supabase PostgreSQL Schema & Seed Setup
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DOMAINS TABLE
CREATE TABLE IF NOT EXISTS public.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'layers',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. PROFILES TABLE (Members & Admins)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID,
    member_id VARCHAR(30) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    contact_number VARCHAR(25) NOT NULL,
    prn_number VARCHAR(30) UNIQUE NOT NULL,
    roll_number VARCHAR(30) NOT NULL,
    academic_year VARCHAR(20) NOT NULL DEFAULT 'SY',
    division VARCHAR(10) NOT NULL DEFAULT 'A',
    designation VARCHAR(50) NOT NULL DEFAULT 'Core Team Member',
    role VARCHAR(30) NOT NULL DEFAULT 'CORE_MEMBER',
    domain_id UUID REFERENCES public.domains(id) ON DELETE SET NULL,
    personal_vehicle BOOLEAN NOT NULL DEFAULT false,
    dob DATE,
    profile_photo_url TEXT,
    date_of_joining DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    password_hash TEXT DEFAULT 'Cabssa@2026',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. EVENTS AND SHIFTS TABLE
CREATE TABLE IF NOT EXISTS public.events_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location VARCHAR(200) NOT NULL,
    domain_id UUID REFERENCES public.domains(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Upcoming',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. EVENT MEMBERS & DUTY ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.event_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events_shifts(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    duty_responsibility TEXT NOT NULL,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ATTENDANCE QR SESSIONS
CREATE TABLE IF NOT EXISTS public.attendance_qr_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events_shifts(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events_shifts(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    scan_method VARCHAR(50) DEFAULT 'REVERSE_QR',
    device_info TEXT,
    CONSTRAINT unique_event_member_attendance UNIQUE (event_id, member_id)
);

-- 7. MEETING MINUTES (MoM)
CREATE TABLE IF NOT EXISTS public.meeting_minutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_title VARCHAR(200) NOT NULL,
    meeting_date DATE NOT NULL,
    agenda TEXT NOT NULL,
    discussion_points TEXT,
    decisions_taken TEXT NOT NULL,
    announcements TEXT,
    attendees_count INT DEFAULT 0,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ACTION ITEMS (Tasks)
CREATE TABLE IF NOT EXISTS public.action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    meeting_id UUID REFERENCES public.meeting_minutes(id) ON DELETE SET NULL,
    event_id UUID REFERENCES public.events_shifts(id) ON DELETE SET NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
    status VARCHAR(30) NOT NULL DEFAULT 'Open',
    due_date DATE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. ACTIVITY AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SEED 8 OFFICIAL DOMAINS
INSERT INTO public.domains (id, name, code, description, icon) VALUES
('11111111-1111-1111-1111-111111111101', 'Technical', 'TECH', 'Web dev, fullstack architecture, competitive coding, hackathons, cloud ops and system maintenance.', 'code'),
('11111111-1111-1111-1111-111111111102', 'Design & Graphics', 'DESIGN', 'Branding, Figma design systems, motion graphics, posters, badges and event banners.', 'palette'),
('11111111-1111-1111-1111-111111111103', 'Registration', 'REG', 'Desk check-ins, ticketing coordination, delegate kits, crowd ingress and attendee validation.', 'clipboard-list'),
('11111111-1111-1111-1111-111111111104', 'Finance & Sponsorship', 'FINANCE', 'Budget auditing, corporate outreach, invoices, vendor disbursements and sponsorship decks.', 'coins'),
('11111111-1111-1111-1111-111111111105', 'Film & Media', 'MEDIA', 'Photography, live coverage, reel production, video editing, interviews and podcast series.', 'video'),
('11111111-1111-1111-1111-111111111106', 'Logistics', 'LOGISTICS', 'Auditorium staging, sound/light tech, mikes, transport, campus permissions and power backups.', 'truck'),
('11111111-1111-1111-1111-111111111107', 'Documentation', 'DOCS', 'Official notices, minutes of meeting, permissions, formal proposals, and annual report archives.', 'file-text'),
('11111111-1111-1111-1111-111111111108', 'Content Creation', 'CONTENT', 'Copywriting, technical blogs, scripts, newsletter editions, captions and social handles.', 'feather')
ON CONFLICT (code) DO NOTHING;

-- SEED PRIMARY ADMIN
INSERT INTO public.profiles (
  id,
  member_id,
  full_name,
  email,
  password_hash,
  contact_number,
  prn_number,
  roll_number,
  academic_year,
  division,
  designation,
  role,
  status
) VALUES (
  '7c498b5f-8329-4cd0-aba9-5af3061d84d2',
  'CABSSA-2026-001',
  'Dinesh Ausaramal',
  'mr.dineshausaramal@gmail.com',
  'Shru_nesh@9158',
  '8080428634',
  '2526UCB026',
  '02',
  'SY',
  'A',
  'Admin',
  'ADMIN',
  'Active'
) ON CONFLICT (email) DO NOTHING;

-- GRANT ACCESS TO API
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- DISABLE RLS FOR ZERO-FRICTION SEAMLESS DIRECT ACCESS
ALTER TABLE public.domains DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.events_shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_qr_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_minutes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;
