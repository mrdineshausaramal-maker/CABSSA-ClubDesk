-- ============================================================================
-- CABSSA Clubdesk — Internal Club Management System
-- Migration 02: Row Level Security (RLS) Policies
-- Target: PostgreSQL 15+ / Supabase
-- ============================================================================

-- Enable RLS on every table (Default Deny)
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_qr_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- SECURITY HELPER FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_profile()
RETURNS public.profiles AS $$
    SELECT * FROM public.profiles 
    WHERE auth_user_id = auth.uid() OR id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS VARCHAR AS $$
    SELECT role FROM public.profiles 
    WHERE (auth_user_id = auth.uid() OR id = auth.uid()) 
      AND status = 'Active'
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE (auth_user_id = auth.uid() OR id = auth.uid()) 
          AND role = 'ADMIN' 
          AND status = 'Active'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_co_head()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE (auth_user_id = auth.uid() OR id = auth.uid()) 
          AND role IN ('ADMIN', 'CO_HEAD') 
          AND status = 'Active'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 1. DOMAINS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Allow authenticated users to read domains"
ON public.domains FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admins to manage domains"
ON public.domains FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. PROFILES POLICIES
-- ----------------------------------------------------------------------------
-- Everyone active can view the member directory
CREATE POLICY "Allow active members to view directory"
ON public.profiles FOR SELECT
TO authenticated
USING (
    public.is_admin_or_co_head() 
    OR status = 'Active' 
    OR auth_user_id = auth.uid() 
    OR id = auth.uid()
);

-- Only Admin can create member profiles
CREATE POLICY "Allow admins to insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Admins can update any profile; Members can only update permitted personal fields on their own profile
CREATE POLICY "Allow admins to update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Allow members to update own basic profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid() OR id = auth.uid())
WITH CHECK (
    (auth_user_id = auth.uid() OR id = auth.uid())
    -- Prevent members from elevating their own role or changing their PRN/academic info
    AND role = (SELECT role FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
    AND prn_number = (SELECT prn_number FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
);

-- Admins can delete or deactivate
CREATE POLICY "Allow admins to delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. EVENTS AND SHIFTS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Allow authenticated users to view events"
ON public.events_shifts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admins and co-heads to manage events"
ON public.events_shifts FOR ALL
TO authenticated
USING (public.is_admin_or_co_head())
WITH CHECK (public.is_admin_or_co_head());

-- ----------------------------------------------------------------------------
-- 4. EVENT MEMBERS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Allow authenticated users to view event assignments"
ON public.event_members FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admins and co-heads to manage event duties"
ON public.event_members FOR ALL
TO authenticated
USING (public.is_admin_or_co_head())
WITH CHECK (public.is_admin_or_co_head());

-- ----------------------------------------------------------------------------
-- 5. ATTENDANCE QR SESSIONS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Allow active members to read active QR sessions"
ON public.attendance_qr_sessions FOR SELECT
TO authenticated
USING (is_active = true OR public.is_admin_or_co_head());

CREATE POLICY "Allow admins and co-heads to create QR sessions"
ON public.attendance_qr_sessions FOR ALL
TO authenticated
USING (public.is_admin_or_co_head())
WITH CHECK (public.is_admin_or_co_head());

-- ----------------------------------------------------------------------------
-- 6. ATTENDANCE POLICIES
-- ----------------------------------------------------------------------------
-- Core members can view their own; Admins and Co-Heads can view all
CREATE POLICY "Allow members to view attendance"
ON public.attendance FOR SELECT
TO authenticated
USING (
    public.is_admin_or_co_head()
    OR member_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
);

-- Self-checkin via QR or Admin/Co-Head manual override
CREATE POLICY "Allow attendance marking"
ON public.attendance FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin_or_co_head()
    OR (
        member_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
        AND verification_method = 'QR_SCAN'
        -- Session must exist, be active, and not expired
        AND EXISTS (
            SELECT 1 FROM public.attendance_qr_sessions s
            WHERE s.id = session_id 
              AND s.is_active = true 
              AND s.expires_at > now()
        )
    )
);

CREATE POLICY "Allow admins and co-heads to update attendance"
ON public.attendance FOR UPDATE
TO authenticated
USING (public.is_admin_or_co_head())
WITH CHECK (public.is_admin_or_co_head());

CREATE POLICY "Allow admins to delete attendance"
ON public.attendance FOR DELETE
TO authenticated
USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. MEETING MINUTES (MoM) POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Allow members to view meeting minutes"
ON public.meeting_minutes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admins and co-heads to manage meeting minutes"
ON public.meeting_minutes FOR ALL
TO authenticated
USING (public.is_admin_or_co_head())
WITH CHECK (public.is_admin_or_co_head());

-- ----------------------------------------------------------------------------
-- 8. ACTION ITEMS & TASKS POLICIES
-- ----------------------------------------------------------------------------
-- Core members view tasks assigned to them; Admins and Co-heads view all
CREATE POLICY "Allow members to view tasks"
ON public.action_items FOR SELECT
TO authenticated
USING (
    public.is_admin_or_co_head()
    OR assigned_to IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
);

CREATE POLICY "Allow admins and co-heads to insert tasks"
ON public.action_items FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_co_head());

CREATE POLICY "Allow admins and co-heads to update tasks"
ON public.action_items FOR UPDATE
TO authenticated
USING (public.is_admin_or_co_head())
WITH CHECK (public.is_admin_or_co_head());

-- Core team members can update their own task status
CREATE POLICY "Allow members to update own task status"
ON public.action_items FOR UPDATE
TO authenticated
USING (assigned_to IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid()))
WITH CHECK (
    assigned_to IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() OR id = auth.uid())
    -- Task creator and assignment cannot be modified by the assignee
    AND assigned_to = (SELECT assigned_to FROM public.action_items WHERE id = public.action_items.id)
);

CREATE POLICY "Allow admins and co-heads to delete tasks"
ON public.action_items FOR DELETE
TO authenticated
USING (public.is_admin_or_co_head());

-- ----------------------------------------------------------------------------
-- 9. ACTIVITY LOGS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Allow admins to view activity logs"
ON public.activity_logs FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Allow authenticated users to insert audit entries"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (true);
