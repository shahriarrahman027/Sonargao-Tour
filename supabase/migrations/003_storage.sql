-- ============================================================================
-- ১ দিনের সস্তায় ট্যুর — Secure Supabase Storage Buckets & Policies
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('tour-photos', 'tour-photos', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('tour-receipts', 'tour-receipts', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Photos bucket: members can read & upload; uploader or admin can delete
CREATE POLICY "Members read tour photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'tour-photos' AND public.is_tour_member());

CREATE POLICY "Members upload tour photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tour-photos' AND public.is_tour_member());

CREATE POLICY "Admin or owner delete tour photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'tour-photos' AND (public.is_tour_admin() OR owner_id = public.current_member_id()::TEXT));

-- Receipts bucket: members can read; ONLY admin can upload/delete
CREATE POLICY "Members read tour receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'tour-receipts' AND public.is_tour_member());

CREATE POLICY "Admin manage tour receipts"
ON storage.objects FOR ALL
USING (bucket_id = 'tour-receipts' AND public.is_tour_admin())
WITH CHECK (bucket_id = 'tour-receipts' AND public.is_tour_admin());
