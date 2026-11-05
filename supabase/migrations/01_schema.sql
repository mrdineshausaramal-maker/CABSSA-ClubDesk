-- ============================================================================
-- CABSSA Clubdesk — Internal Club Management System
-- Migration 01: Core Relational Database Schema
-- Target: PostgreSQL 15+ / Supabase
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean existing tables if needed for fresh setup
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.action_items CASCADE;
DROP TABLE IF EXISTS public.meeting_minutes CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.attendance_qr_sessions CASCADE;
DROP TABLE IF EXISTS public.event_members CASCADE;
DROP TABLE IF EXISTS public.events_shifts CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.domains CASCADE;

-- ----------------------------------------------------------------------------
-- 1. DOMAINS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE public.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'layers',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. PROFILES TABLE (Committee Members)
-- References auth.users(id) in Supabase or operates standalone
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- linked to Supabase auth.users(id)
    member_id VARCHAR(30) UNIQUE NOT NULL, -- e.g. 'CABSSA-2026-001'
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    contact_number VARCHAR(25) NOT NULL,
    prn_number VARCHAR(30) UNIQUE NOT NULL,
    roll_number VARCHAR(30) NOT NULL,
    academic_year VARCHAR(20) NOT NULL CHECK (academic_year IN ('FY', 'SY', 'TY', 'Final Year')),
    division VARCHAR(10) NOT NULL CHECK (division IN ('A', 'B', 'C', 'D')),
    designation VARCHAR(50) NOT NULL CHECK (designation IN ('Admin', 'Head', 'Co-Head', 'Core Team Member')),
    role VARCHAR(30) NOT NULL DEFAULT 'CORE_MEMBER' CHECK (role IN ('ADMIN', 'CO_HEAD', 'CORE_MEMBER')),
    domain_id UUID REFERENCES public.domains(id) ON DELETE SET NULL,
    personal_vehicle BOOLEAN NOT NULL DEFAULT false,
    dob DATE,
    profile_photo_url TEXT,
    date_of_joining DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    password_hash TEXT, -- Used for local/direct auth fallback
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lightning-fast queries
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_prn ON public.profiles(prn_number);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_domain ON public.profiles(domain_id);
CREATE INDEX idx_profiles_status ON public.profiles(status);

-- ----------------------------------------------------------------------------
-- 3. EVENTS AND SHIFTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE public.events_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location VARCHAR(200) NOT NULL,
    domain_id UUID REFERENCES public.domains(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Upcoming', 'Ongoing', 'Completed', 'Cancelled')),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_date ON public.events_shifts(event_date);
CREATE INDEX idx_events_status ON public.events_shifts(status);

-- ----------------------------------------------------------------------------
-- 4. EVENT MEMBERS & DUTY ASSIGNMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE public.event_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events_shifts(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    duty_responsibility TEXT NOT NULL,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_event_member UNIQUE (event_id, member_id)
);

CREATE INDEX idx_event_members_event ON public.event_members(event_id);
CREATE INDEX idx_event_members_member ON public.event_members(member_id);

-- ----------------------------------------------------------------------------
-- 5. ATTENDANCE QR SESSIONS TABLE (Reverse QR System)
-- ----------------------------------------------------------------------------
CREATE TABLE public.attendance_qr_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events_shifts(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_qr_sessions_token ON public.attendance_qr_sessions(token);
CREATE INDEX idx_qr_sessions_event ON public.attendance_qr_sessions(event_id);

-- ----------------------------------------------------------------------------
-- 6. ATTENDANCE TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events_shifts(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.attendance_qr_sessions(id) ON DELETE SET NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verification_method VARCHAR(30) NOT NULL DEFAULT 'QR_SCAN' CHECK (verification_method IN ('QR_SCAN', 'MANUAL_OVERRIDE')),
    status VARCHAR(20) NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Late', 'Excused', 'Absent')),
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_event_member_attendance UNIQUE (event_id, member_id)
);

CREATE INDEX idx_attendance_event ON public.attendance(event_id);
CREATE INDEX idx_attendance_member ON public.attendance(member_id);

-- ----------------------------------------------------------------------------
-- 7. MEETING MINUTES (MoM) TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE public.meeting_minutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    meeting_date TIMESTAMPTZ NOT NULL,
    agenda TEXT NOT NULL,
    discussion_points TEXT NOT NULL,
    decisions_taken TEXT NOT NULL,
    announcements TEXT,
    meeting_notes TEXT,
    attendee_ids UUID[] DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meetings_date ON public.meeting_minutes(meeting_date);

-- ----------------------------------------------------------------------------
-- 8. ACTION ITEMS & TASKS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE public.action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_code VARCHAR(30) UNIQUE NOT NULL, -- e.g. 'TASK-101'
    title VARCHAR(200) NOT NULL,
    description TEXT,
    assigned_to UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    meeting_id UUID REFERENCES public.meeting_minutes(id) ON DELETE SET NULL,
    event_id UUID REFERENCES public.events_shifts(id) ON DELETE SET NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status VARCHAR(30) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Completed')),
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    completed_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_assigned_to ON public.action_items(assigned_to);
CREATE INDEX idx_tasks_status ON public.action_items(status);
CREATE INDEX idx_tasks_due_date ON public.action_items(due_date);

-- ----------------------------------------------------------------------------
-- 9. AUDIT & ACTIVITY LOGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name VARCHAR(150),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_actor ON public.activity_logs(actor_id);
CREATE INDEX idx_activity_created ON public.activity_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- AUTOMATIC updated_at TRIGGER FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON public.events_shifts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_meetings_updated_at
BEFORE UPDATE ON public.meeting_minutes
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_tasks_updated_at
BEFORE UPDATE ON public.action_items
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
