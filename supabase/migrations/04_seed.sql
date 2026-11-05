-- ============================================================================
-- CABSSA Clubdesk — Internal Club Management System
-- Migration 04: Seed Data (Domains, Core Profiles, Events, Tasks)
-- Target: PostgreSQL 15+ / Supabase
-- ============================================================================

-- 1. SEED 8 OFFICIAL COLLEGE DOMAINS
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

-- 2. SEED SAMPLE COMMITTEE PROFILES
-- Password for all sample accounts is: 'Admin@123' / 'Cabssa@2026'
INSERT INTO public.profiles (
    id, member_id, full_name, email, contact_number, prn_number, roll_number, 
    academic_year, division, designation, role, domain_id, personal_vehicle, dob, 
    date_of_joining, status
) VALUES
(
    '22222222-2222-2222-2222-222222222201',
    'CABSSA-2024-001',
    'Prof. Rajesh Kulkarni / Lead Admin',
    'admin@cabssa.internal',
    '+91 98230 11223',
    'PRN202400199',
    'STAFF-01',
    'TY',
    'A',
    'Admin',
    'ADMIN',
    '11111111-1111-1111-1111-111111111101',
    true,
    '2003-04-12',
    '2024-07-01',
    'Active'
),
(
    '22222222-2222-2222-2222-222222222202',
    'CABSSA-2024-015',
    'Sakshi Deshmukh',
    'cohead@cabssa.internal',
    '+91 98901 33445',
    'PRN202401542',
    '23CS15',
    'TY',
    'B',
    'Co-Head',
    'CO_HEAD',
    '11111111-1111-1111-1111-111111111101',
    false,
    '2004-09-18',
    '2024-07-15',
    'Active'
),
(
    '22222222-2222-2222-2222-222222222203',
    'CABSSA-2025-042',
    'Rohan Verma',
    'member@cabssa.internal',
    '+91 97654 55667',
    'PRN202504288',
    '24CS42',
    'SY',
    'A',
    'Core Team Member',
    'CORE_MEMBER',
    '11111111-1111-1111-1111-111111111101',
    true,
    '2005-01-22',
    '2025-08-01',
    'Active'
),
(
    '22222222-2222-2222-2222-222222222204',
    'CABSSA-2024-008',
    'Ananya Joshi',
    'ananya.design@cabssa.internal',
    '+91 98212 99001',
    'PRN202400812',
    '23CS08',
    'TY',
    'A',
    'Head',
    'CO_HEAD',
    '11111111-1111-1111-1111-111111111102',
    false,
    '2004-03-15',
    '2024-07-10',
    'Active'
),
(
    '22222222-2222-2222-2222-222222222205',
    'CABSSA-2025-019',
    'Aditya Patil',
    'aditya.logistics@cabssa.internal',
    '+91 95451 77889',
    'PRN202501934',
    '24CS19',
    'SY',
    'C',
    'Core Team Member',
    'CORE_MEMBER',
    '11111111-1111-1111-1111-111111111106',
    true,
    '2005-06-30',
    '2025-08-10',
    'Active'
)
ON CONFLICT (prn_number) DO NOTHING;

-- 3. SEED SAMPLE EVENTS
INSERT INTO public.events_shifts (
    id, title, description, event_date, start_time, end_time, location, domain_id, status, created_by
) VALUES
(
    '33333333-3333-3333-3333-333333333301',
    'CABSSA Technical Sprint & Cloud Architecture Summit',
    'Flagship state-level student technical conference featuring system design talks and live API hack sessions.',
    CURRENT_DATE + INTERVAL '5 days',
    '09:30:00',
    '17:00:00',
    'Central Auditorium, Tech Block B',
    '11111111-1111-1111-1111-111111111101',
    'Upcoming',
    '22222222-2222-2222-2222-222222222201'
),
(
    '33333333-3333-3333-3333-333333333302',
    'UI/UX Design Jam & Figma Component Workshop',
    'Hands-on interactive design workshop covering modern component architecture, micro-interactions, and design tokens.',
    CURRENT_DATE + INTERVAL '12 days',
    '14:00:00',
    '18:30:00',
    'Computer Center Lab 4',
    '11111111-1111-1111-1111-111111111102',
    'Upcoming',
    '22222222-2222-2222-2222-222222222204'
),
(
    '33333333-3333-3333-3333-333333333303',
    'Induction & Executive Committee Orientation 2026',
    'Orientation ceremony for newly inducted core team members with domain briefings and charter distribution.',
    CURRENT_DATE - INTERVAL '10 days',
    '10:00:00',
    '13:00:00',
    'Seminar Hall 2',
    NULL,
    'Completed',
    '22222222-2222-2222-2222-222222222201'
)
ON CONFLICT (id) DO NOTHING;

-- 4. SEED EVENT DUTY ASSIGNMENTS
INSERT INTO public.event_members (id, event_id, member_id, duty_responsibility, assigned_by) VALUES
(
    gen_random_uuid(),
    '33333333-3333-3333-3333-333333333301',
    '22222222-2222-2222-2222-222222222202',
    'Technical setup: Stage HDMI splitters, live stream server, and projector calibration.',
    '22222222-2222-2222-2222-222222222201'
),
(
    gen_random_uuid(),
    '33333333-3333-3333-3333-333333333301',
    '22222222-2222-2222-2222-222222222203',
    'Speaker stage management and cloud lab runner machines.',
    '22222222-2222-2222-2222-222222222202'
)
ON CONFLICT (event_id, member_id) DO NOTHING;

-- 5. SEED MEETING MINUTES (MoM)
INSERT INTO public.meeting_minutes (
    id, title, meeting_date, agenda, discussion_points, decisions_taken, announcements, meeting_notes, created_by
) VALUES
(
    '44444444-4444-4444-4444-444444444401',
    'Executive Core Planning Meet: Semester 2 Roadmap',
    now() - INTERVAL '3 days',
    '1. Finalization of Technical Sprint Dates
2. Sponsorship package tiers for Corporate Partners
3. Reverse QR attendance rollout for general body meetings',
    'Discussed corporate sponsorship deliverables with Finance Lead. Reviewed QR attendance scanner prototype.',
    '1. Approved 3-tier sponsorship package (Gold, Silver, Tech Partner).
2. Deployed Reverse QR code generator across all upcoming committee meets.
3. Logistics to reserve Central Auditorium by Friday.',
    'Next all-hands briefing scheduled for Monday 5 PM.',
    'All domain leads must submit sprint estimates by Thursday midnight.',
    '22222222-2222-2222-2222-222222222201'
)
ON CONFLICT (id) DO NOTHING;

-- 6. SEED ACTION ITEMS & TASKS
INSERT INTO public.action_items (
    id, task_code, title, description, assigned_to, meeting_id, priority, status, assigned_date, due_date, created_by
) VALUES
(
    '55555555-5555-5555-5555-555555555501',
    'TASK-101',
    'Configure Reverse QR Scanner in Clubdesk',
    'Implement front-camera QR scanner and token validation endpoint for the upcoming Tech Summit.',
    '22222222-2222-2222-2222-222222222203',
    '44444444-4444-4444-4444-444444444401',
    'High',
    'In Progress',
    CURRENT_DATE - INTERVAL '2 days',
    CURRENT_DATE + INTERVAL '2 days',
    '22222222-2222-2222-2222-222222222201'
),
(
    '55555555-5555-5555-5555-555555555502',
    'TASK-102',
    'Design Tech Summit Delegate Badges & Lanyards',
    'Create print-ready 300 DPI SVG badges with individual participant QR codes and sponsor logos.',
    '22222222-2222-2222-2222-222222222204',
    '44444444-4444-4444-4444-444444444401',
    'Urgent',
    'Open',
    CURRENT_DATE - INTERVAL '1 day',
    CURRENT_DATE + INTERVAL '3 days',
    '22222222-2222-2222-2222-222222222202'
),
(
    '55555555-5555-5555-5555-555555555503',
    'TASK-103',
    'Submit Auditorium Sound Permissions to Dean Office',
    'Draft and deliver formal letter signed by Faculty Coordinator for 1000W PA system and cordless mikes.',
    '22222222-2222-2222-2222-222222222205',
    '44444444-4444-4444-4444-444444444401',
    'Medium',
    'Completed',
    CURRENT_DATE - INTERVAL '4 days',
    CURRENT_DATE - INTERVAL '1 day',
    '22222222-2222-2222-2222-222222222201'
)
ON CONFLICT (task_code) DO NOTHING;

-- 7. SEED INITIAL ATTENDANCE RECORD
INSERT INTO public.attendance (
    id, event_id, member_id, marked_at, verification_method, status
) VALUES
(
    gen_random_uuid(),
    '33333333-3333-3333-3333-333333333303',
    '22222222-2222-2222-2222-222222222202',
    now() - INTERVAL '10 days',
    'MANUAL_OVERRIDE',
    'Present'
),
(
    gen_random_uuid(),
    '33333333-3333-3333-3333-333333333303',
    '22222222-2222-2222-2222-222222222203',
    now() - INTERVAL '10 days',
    'QR_SCAN',
    'Present'
)
ON CONFLICT (event_id, member_id) DO NOTHING;

-- 8. SEED INITIAL ACTIVITY LOGS
INSERT INTO public.activity_logs (
    actor_id, actor_name, action, entity_type, entity_id, details
) VALUES
(
    '22222222-2222-2222-2222-222222222201',
    'Prof. Rajesh Kulkarni / Lead Admin',
    'SYSTEM_INITIALIZED',
    'SYSTEM',
    'ROOT',
    '{"message": "CABSSA Clubdesk initialized with 8 operational domains and security policies"}'::jsonb
);
