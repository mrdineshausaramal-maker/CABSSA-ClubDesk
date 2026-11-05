-- ============================================================================
-- CABSSA Clubdesk — Internal Club Management System
-- Migration 03: Supabase Storage Setup & Security Policies
-- Target: Supabase Storage API
-- ============================================================================

-- 1. Create the 'member-photos' storage bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'member-photos', 
    'member-photos', 
    true, 
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Create the 'club-documents' bucket for reports/minutes/attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'club-documents', 
    'club-documents', 
    false, 
    20971520, -- 20 MB limit
    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/csv']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 20971520;

-- 3. Storage Row Level Security Policies
-- Allow public or authenticated users to read member profile photos
CREATE POLICY "Public Read for Member Photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'member-photos');

-- Allow authenticated users to upload their own photo or admins to upload any photo
CREATE POLICY "Authenticated Upload Member Photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'member-photos' 
    AND (
        -- User can upload to their own folder: member-photos/{user_id}/*
        auth.uid()::text = (storage.foldername(name))[1]
        OR public.is_admin()
    )
);

-- Allow authenticated users to update their own photo or admins to update
CREATE POLICY "Authenticated Update Member Photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'member-photos' 
    AND (
        auth.uid()::text = (storage.foldername(name))[1]
        OR public.is_admin()
    )
);

-- Allow authenticated users to delete their own photo or admins to delete
CREATE POLICY "Authenticated Delete Member Photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'member-photos' 
    AND (
        auth.uid()::text = (storage.foldername(name))[1]
        OR public.is_admin()
    )
);
