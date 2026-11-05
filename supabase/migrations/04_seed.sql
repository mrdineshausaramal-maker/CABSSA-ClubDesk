-- ============================================================================
-- CABSSA Clubdesk — Internal Club Management System
-- Migration 04: Seed Data (8 Official Association Domains Only)
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

-- Zero pre-populated events or dummy members.
-- The initial Super Administrator will be provisioned directly via the setup screen
-- or via Supabase Edge Function: admin-provision-member.
