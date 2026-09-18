-- ============================================================
-- PromptHub v5 — Database Rollback (NON-DESTRUKTIF)
-- ============================================================
-- CATATAN: Script ini TIDAK drop table atau column.
-- Hanya rollback policy, function, dan trigger.
-- Jika perlu drop table/column, backup dulu dan konfirmasi manual.
-- ============================================================

-- ────────────────────────────────────────────
-- ROLLBACK HELPER FUNCTIONS
-- ────────────────────────────────────────────

-- Hapus helper baru
DROP FUNCTION IF EXISTS is_architect();
DROP FUNCTION IF EXISTS has_admin_permission(TEXT);
DROP FUNCTION IF EXISTS is_admin_or_above();

-- Restore helper lama
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;


-- ────────────────────────────────────────────
-- ROLLBACK TRIGGER (HATI-HATI — ini membuka celah lagi)
-- Hanya jalankan jika benar-benar perlu rollback
-- ────────────────────────────────────────────
-- CREATE OR REPLACE FUNCTION handle_new_user()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   INSERT INTO public.profiles (id, display_name, role)
--   VALUES (
--     NEW.id,
--     COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
--     COALESCE(NEW.raw_user_meta_data->>'role', 'member')
--   );
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- PERINGATAN: Trigger lama memiliki celah self-promote.
-- Sebaiknya JANGAN rollback trigger ini kecuali darurat.


-- ────────────────────────────────────────────
-- ROLLBACK RLS POLICIES
-- ────────────────────────────────────────────

-- Drop policy baru
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
DROP POLICY IF EXISTS "admin_perm_select" ON admin_permissions;
DROP POLICY IF EXISTS "admin_perm_insert" ON admin_permissions;
DROP POLICY IF EXISTS "admin_perm_update" ON admin_permissions;
DROP POLICY IF EXISTS "admin_perm_delete" ON admin_permissions;
DROP POLICY IF EXISTS "categories_select" ON categories;
DROP POLICY IF EXISTS "categories_insert" ON categories;
DROP POLICY IF EXISTS "categories_update" ON categories;
DROP POLICY IF EXISTS "categories_delete" ON categories;
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;
DROP POLICY IF EXISTS "articles_select" ON articles;
DROP POLICY IF EXISTS "articles_insert" ON articles;
DROP POLICY IF EXISTS "articles_update" ON articles;
DROP POLICY IF EXISTS "articles_delete" ON articles;
DROP POLICY IF EXISTS "slides_select" ON hero_slides;
DROP POLICY IF EXISTS "slides_insert" ON hero_slides;
DROP POLICY IF EXISTS "slides_update" ON hero_slides;
DROP POLICY IF EXISTS "slides_delete" ON hero_slides;
DROP POLICY IF EXISTS "feedback_select" ON feedback_requests;
DROP POLICY IF EXISTS "feedback_insert" ON feedback_requests;
DROP POLICY IF EXISTS "feedback_update" ON feedback_requests;
DROP POLICY IF EXISTS "settings_select" ON site_settings;
DROP POLICY IF EXISTS "settings_update" ON site_settings;
DROP POLICY IF EXISTS "settings_insert" ON site_settings;
DROP POLICY IF EXISTS "bookmarks_select" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_insert" ON bookmarks;
DROP POLICY IF EXISTS "bookmarks_delete" ON bookmarks;
DROP POLICY IF EXISTS "analytics_select" ON analytics;
DROP POLICY IF EXISTS "analytics_insert" ON analytics;
DROP POLICY IF EXISTS "popup_select" ON popup_banners;
DROP POLICY IF EXISTS "popup_insert" ON popup_banners;
DROP POLICY IF EXISTS "popup_update" ON popup_banners;
DROP POLICY IF EXISTS "popup_delete" ON popup_banners;

-- Drop storage policy baru
DROP POLICY IF EXISTS "media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "media_admin_read" ON storage.objects;
DROP POLICY IF EXISTS "media_architect_upload" ON storage.objects;
DROP POLICY IF EXISTS "media_admin_upload" ON storage.objects;
DROP POLICY IF EXISTS "media_user_upload_requests" ON storage.objects;
DROP POLICY IF EXISTS "media_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "media_admin_update" ON storage.objects;

-- Restore policy lama (dari v1 migration)
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());
CREATE POLICY "Admin can update any profile" ON profiles FOR UPDATE
  USING (is_admin());
CREATE POLICY "Anyone can read categories" ON categories FOR SELECT
  USING (true);
CREATE POLICY "Admin can manage categories" ON categories FOR ALL
  USING (is_admin());
CREATE POLICY "Members read published projects" ON projects FOR SELECT
  USING (is_published = true OR is_admin());
CREATE POLICY "Admin can manage projects" ON projects FOR ALL
  USING (is_admin());
CREATE POLICY "Members read published articles" ON articles FOR SELECT
  USING (is_published = true OR is_admin());
CREATE POLICY "Admin can manage articles" ON articles FOR ALL
  USING (is_admin());
CREATE POLICY "Anyone can read active slides" ON hero_slides FOR SELECT
  USING (is_active = true OR is_admin());
CREATE POLICY "Admin can manage slides" ON hero_slides FOR ALL
  USING (is_admin());
CREATE POLICY "Users can read own requests" ON feedback_requests FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "Anyone can create requests" ON feedback_requests FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Admin can update requests" ON feedback_requests FOR UPDATE
  USING (is_admin());
CREATE POLICY "Anyone can read site_settings" ON site_settings FOR SELECT
  USING (true);
CREATE POLICY "Admin can update site_settings" ON site_settings FOR UPDATE
  USING (is_admin());
CREATE POLICY "Admin can insert site_settings" ON site_settings FOR INSERT
  WITH CHECK (is_admin());
CREATE POLICY "Users can read own bookmarks" ON bookmarks FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Users can manage own bookmarks" ON bookmarks FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own bookmarks" ON bookmarks FOR DELETE
  USING (user_id = auth.uid());
CREATE POLICY "Anyone can insert analytics" ON analytics FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Admin can read analytics" ON analytics FOR SELECT
  USING (is_admin());

-- Restore storage policy lama
CREATE POLICY "Public read media" ON storage.objects FOR SELECT
  USING (bucket_id = 'media');
CREATE POLICY "Admin upload media" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media' AND is_admin());
CREATE POLICY "Users upload feedback media" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'feedback'
    AND auth.uid() IS NOT NULL
  );
CREATE POLICY "Admin delete media" ON storage.objects FOR DELETE
  USING (bucket_id = 'media' AND is_admin());


-- ────────────────────────────────────────────
-- CATATAN: KOLOM/TABEL BARU TIDAK DI-DROP
-- ────────────────────────────────────────────
-- Kolom berikut TETAP ada (tidak dihapus agar data tidak hilang):
-- - categories.slug, categories.is_active
-- - articles.external_url, articles.external_button_label
-- - projects.tutorial_video_url
-- - feedback_requests.type, project_id, attachment_url, attachment_type, updated_at
-- - site_settings.feedback_enabled, popup_enabled
--
-- Tabel berikut TETAP ada:
-- - admin_permissions (mungkin sudah berisi data)
-- - popup_banners (mungkin sudah berisi data)
--
-- Jika perlu menghapusnya:
-- 1. Backup data dulu
-- 2. Konfirmasi manual
-- 3. Jalankan DROP TABLE atau ALTER TABLE DROP COLUMN secara manual


-- ────────────────────────────────────────────
-- ROLLBACK ROLE CONSTRAINT (opsional)
-- ────────────────────────────────────────────
-- Jika ingin kembali ke role admin/member saja:
-- UPDATE profiles SET role = 'admin' WHERE role = 'architect';
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
--   CHECK (role IN ('admin', 'member'));
--
-- PERINGATAN: Ini akan menghilangkan role architect.
-- Sebaiknya JANGAN dijalankan kecuali darurat.


-- ============================================================
-- ROLLBACK SELESAI
-- ============================================================
