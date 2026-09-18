-- ============================================================
-- PromptHub v5 — Database Migration UP
-- ============================================================
-- INSTRUKSI:
-- 1. BACKUP database sebelum menjalankan script ini
-- 2. Jalankan di Supabase Dashboard → SQL Editor → New Query
-- 3. Baca setiap section, pastikan paham sebelum run
-- 4. Migration architect utama ada di section terpisah (1c)
--    → JANGAN jalankan tanpa konfirmasi email/ID
-- ============================================================

-- ────────────────────────────────────────────
-- 1a. FIX TRIGGER handle_new_user() — TUTUP CELAH SELF-PROMOTE
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    'member'  -- SELALU default member, JANGAN ambil dari metadata
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Pastikan trigger terpasang
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ────────────────────────────────────────────
-- 1b. UBAH ROLE CONSTRAINT — TAMBAH 'architect'
-- ────────────────────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('architect', 'admin', 'member'));


-- ────────────────────────────────────────────
-- 1c. MIGRASI ADMIN UTAMA → ARCHITECT
-- JALANKAN MANUAL SETELAH KONFIRMASI
-- Email: arbysatriaexpert@gmail.com
-- ────────────────────────────────────────────
-- Cari user ID berdasarkan email di auth.users, lalu update profiles
UPDATE public.profiles
SET role = 'architect'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'arbysatriaexpert@gmail.com'
  LIMIT 1
);


-- ────────────────────────────────────────────
-- 1d. TABEL admin_permissions
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  can_view_dashboard BOOLEAN NOT NULL DEFAULT false,
  can_manage_projects BOOLEAN NOT NULL DEFAULT false,
  can_manage_categories BOOLEAN NOT NULL DEFAULT false,
  can_manage_articles BOOLEAN NOT NULL DEFAULT false,
  can_manage_slides BOOLEAN NOT NULL DEFAULT false,
  can_manage_requests BOOLEAN NOT NULL DEFAULT false,
  can_manage_users BOOLEAN NOT NULL DEFAULT false,
  can_manage_settings BOOLEAN NOT NULL DEFAULT false,
  can_manage_popup_banners BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────
-- 1e. TABEL popup_banners
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS popup_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  link_url TEXT DEFAULT '',
  button_label TEXT DEFAULT 'Lihat Selengkapnya',
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_after_login BOOLEAN NOT NULL DEFAULT true,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE popup_banners ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────
-- 1f. TAMBAH KOLOM BARU DI TABEL EXISTING
-- ────────────────────────────────────────────

-- categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Auto-generate slug dari nama existing
UPDATE categories
SET slug = lower(
  regexp_replace(
    regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL;

-- articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS external_button_label TEXT DEFAULT 'Kunjungi Website';

-- projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tutorial_video_url TEXT;

-- feedback_requests — tambah kolom baru
ALTER TABLE feedback_requests ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'request';
-- Tambah constraint type setelah kolom dibuat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_requests_type_check'
  ) THEN
    ALTER TABLE feedback_requests ADD CONSTRAINT feedback_requests_type_check
      CHECK (type IN ('request', 'bug', 'glitch', 'feedback'));
  END IF;
END $$;

ALTER TABLE feedback_requests ADD COLUMN IF NOT EXISTS project_id UUID
  REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE feedback_requests ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE feedback_requests ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE feedback_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- site_settings
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY,
  whatsapp_number TEXT,
  contact_email TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO site_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS feedback_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS popup_enabled BOOLEAN NOT NULL DEFAULT true;


-- ────────────────────────────────────────────
-- 1g. ANALYTICS action_type — HANDLE DATA LAMA
-- ────────────────────────────────────────────
-- Step 1: Update data lama 'download' → 'view' SEBELUM ubah constraint
UPDATE analytics SET action_type = 'view' WHERE action_type = 'download';

-- Step 2: Drop constraint lama, buat baru
ALTER TABLE analytics DROP CONSTRAINT IF EXISTS analytics_action_type_check;
ALTER TABLE analytics ADD CONSTRAINT analytics_action_type_check
  CHECK (action_type IN ('copy', 'generate', 'view'));


-- ────────────────────────────────────────────
-- 1h. HELPER FUNCTIONS — DENGAN WHITELIST
-- ────────────────────────────────────────────

-- Drop helper lama
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Cek architect (akses penuh)
CREATE OR REPLACE FUNCTION is_architect()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'architect'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Cek admin permission DENGAN WHITELIST
CREATE OR REPLACE FUNCTION has_admin_permission(perm TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  has_perm BOOLEAN;
  allowed_perms TEXT[] := ARRAY[
    'can_view_dashboard',
    'can_manage_projects',
    'can_manage_categories',
    'can_manage_articles',
    'can_manage_slides',
    'can_manage_requests',
    'can_manage_users',
    'can_manage_settings',
    'can_manage_popup_banners'
  ];
BEGIN
  -- Whitelist: tolak permission name yang tidak dikenal
  IF NOT (perm = ANY(allowed_perms)) THEN
    RETURN false;
  END IF;

  SELECT role INTO user_role FROM profiles WHERE id = auth.uid();

  -- Architect = full access
  IF user_role = 'architect' THEN RETURN true; END IF;

  -- Bukan admin = no access
  IF user_role != 'admin' THEN RETURN false; END IF;

  -- Cek permission spesifik
  EXECUTE format(
    'SELECT %I FROM admin_permissions WHERE user_id = $1',
    perm
  ) INTO has_perm USING auth.uid();

  RETURN COALESCE(has_perm, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper backward-compat: is_admin_or_above = architect OR admin
CREATE OR REPLACE FUNCTION is_admin_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('architect', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;


-- ============================================================
-- 1i. RLS — DROP POLICY LAMA, BUAT BARU
-- ============================================================

-- ── PROFILES ──
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can update any profile" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR is_architect()
    OR has_admin_permission('can_manage_users')
  );

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- User biasa tidak boleh ubah role atau is_active sendiri
    -- Ini di-enforce di application level juga
  );

CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  USING (
    is_architect()
    OR has_admin_permission('can_manage_users')
  );


-- ── ADMIN PERMISSIONS ──
CREATE POLICY "admin_perm_select" ON admin_permissions FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_architect()
  );

CREATE POLICY "admin_perm_insert" ON admin_permissions FOR INSERT
  WITH CHECK (is_architect());

CREATE POLICY "admin_perm_update" ON admin_permissions FOR UPDATE
  USING (is_architect());

CREATE POLICY "admin_perm_delete" ON admin_permissions FOR DELETE
  USING (is_architect());


-- ── CATEGORIES ──
DROP POLICY IF EXISTS "Anyone can read categories" ON categories;
DROP POLICY IF EXISTS "Admin can manage categories" ON categories;

CREATE POLICY "categories_select" ON categories FOR SELECT
  USING (
    is_active = true
    OR is_architect()
    OR has_admin_permission('can_manage_categories')
  );

CREATE POLICY "categories_insert" ON categories FOR INSERT
  WITH CHECK (has_admin_permission('can_manage_categories'));

CREATE POLICY "categories_update" ON categories FOR UPDATE
  USING (has_admin_permission('can_manage_categories'));

CREATE POLICY "categories_delete" ON categories FOR DELETE
  USING (has_admin_permission('can_manage_categories'));


-- ── PROJECTS ──
DROP POLICY IF EXISTS "Members read published projects" ON projects;
DROP POLICY IF EXISTS "Admin can manage projects" ON projects;

CREATE POLICY "projects_select" ON projects FOR SELECT
  USING (
    is_published = true
    OR is_architect()
    OR has_admin_permission('can_manage_projects')
  );

CREATE POLICY "projects_insert" ON projects FOR INSERT
  WITH CHECK (has_admin_permission('can_manage_projects'));

CREATE POLICY "projects_update" ON projects FOR UPDATE
  USING (has_admin_permission('can_manage_projects'));

CREATE POLICY "projects_delete" ON projects FOR DELETE
  USING (has_admin_permission('can_manage_projects'));


-- ── ARTICLES ──
DROP POLICY IF EXISTS "Members read published articles" ON articles;
DROP POLICY IF EXISTS "Admin can manage articles" ON articles;

CREATE POLICY "articles_select" ON articles FOR SELECT
  USING (
    is_published = true
    OR is_architect()
    OR has_admin_permission('can_manage_articles')
  );

CREATE POLICY "articles_insert" ON articles FOR INSERT
  WITH CHECK (has_admin_permission('can_manage_articles'));

CREATE POLICY "articles_update" ON articles FOR UPDATE
  USING (has_admin_permission('can_manage_articles'));

CREATE POLICY "articles_delete" ON articles FOR DELETE
  USING (has_admin_permission('can_manage_articles'));


-- ── HERO SLIDES ──
DROP POLICY IF EXISTS "Anyone can read active slides" ON hero_slides;
DROP POLICY IF EXISTS "Admin can manage slides" ON hero_slides;

CREATE POLICY "slides_select" ON hero_slides FOR SELECT
  USING (
    is_active = true
    OR is_architect()
    OR has_admin_permission('can_manage_slides')
  );

CREATE POLICY "slides_insert" ON hero_slides FOR INSERT
  WITH CHECK (has_admin_permission('can_manage_slides'));

CREATE POLICY "slides_update" ON hero_slides FOR UPDATE
  USING (has_admin_permission('can_manage_slides'));

CREATE POLICY "slides_delete" ON hero_slides FOR DELETE
  USING (has_admin_permission('can_manage_slides'));


-- ── FEEDBACK REQUESTS ──
DROP POLICY IF EXISTS "Users can read own requests" ON feedback_requests;
DROP POLICY IF EXISTS "Anyone can create requests" ON feedback_requests;
DROP POLICY IF EXISTS "Admin can update requests" ON feedback_requests;

CREATE POLICY "feedback_select" ON feedback_requests FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_architect()
    OR has_admin_permission('can_manage_requests')
  );

CREATE POLICY "feedback_insert" ON feedback_requests FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

CREATE POLICY "feedback_update" ON feedback_requests FOR UPDATE
  USING (
    is_architect()
    OR has_admin_permission('can_manage_requests')
  );


-- ── SITE SETTINGS ──
DROP POLICY IF EXISTS "Anyone can read site_settings" ON site_settings;
DROP POLICY IF EXISTS "Admin can update site_settings" ON site_settings;
DROP POLICY IF EXISTS "Admin can insert site_settings" ON site_settings;

CREATE POLICY "settings_select" ON site_settings FOR SELECT
  USING (true);

CREATE POLICY "settings_update" ON site_settings FOR UPDATE
  USING (has_admin_permission('can_manage_settings'));

CREATE POLICY "settings_insert" ON site_settings FOR INSERT
  WITH CHECK (has_admin_permission('can_manage_settings'));


-- ── BOOKMARKS ──
-- Policy sudah benar, tapi recreate untuk konsistensi
DROP POLICY IF EXISTS "Users can read own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can manage own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON bookmarks;

CREATE POLICY "bookmarks_select" ON bookmarks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "bookmarks_insert" ON bookmarks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bookmarks_delete" ON bookmarks FOR DELETE
  USING (user_id = auth.uid());


-- ── ANALYTICS ──
DROP POLICY IF EXISTS "Anyone can insert analytics" ON analytics;
DROP POLICY IF EXISTS "Admin can read analytics" ON analytics;

CREATE POLICY "analytics_select" ON analytics FOR SELECT
  USING (
    is_architect()
    OR has_admin_permission('can_view_dashboard')
  );

CREATE POLICY "analytics_insert" ON analytics FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND action_type IN ('copy', 'generate', 'view')
  );


-- ── POPUP BANNERS ──
CREATE POLICY "popup_select" ON popup_banners FOR SELECT
  USING (
    (is_active = true AND (start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at >= now()))
    OR is_architect()
    OR has_admin_permission('can_manage_popup_banners')
  );

CREATE POLICY "popup_insert" ON popup_banners FOR INSERT
  WITH CHECK (has_admin_permission('can_manage_popup_banners'));

CREATE POLICY "popup_update" ON popup_banners FOR UPDATE
  USING (has_admin_permission('can_manage_popup_banners'));

CREATE POLICY "popup_delete" ON popup_banners FOR DELETE
  USING (has_admin_permission('can_manage_popup_banners'));


-- ============================================================
-- 1j. STORAGE POLICY — PRIVATE requests/
-- ============================================================

-- Drop policy lama
DROP POLICY IF EXISTS "Public read media" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload media" ON storage.objects;
DROP POLICY IF EXISTS "Users upload feedback media" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete media" ON storage.objects;

-- Public read: HANYA folder publik tertentu
CREATE POLICY "media_public_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'media'
    AND (
      (storage.foldername(name))[1] IN ('thumbnails', 'articles', 'slides', 'tutorials', 'popup-banners')
    )
  );

-- Admin/architect read: semua folder termasuk requests/
CREATE POLICY "media_admin_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'media'
    AND (is_architect() OR is_admin_or_above())
  );

-- Architect upload: semua folder
CREATE POLICY "media_architect_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'media'
    AND is_architect()
  );

-- Admin upload: folder sesuai permission
CREATE POLICY "media_admin_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'media'
    AND (
      ((storage.foldername(name))[1] = 'thumbnails' AND has_admin_permission('can_manage_projects'))
      OR ((storage.foldername(name))[1] = 'tutorials' AND has_admin_permission('can_manage_projects'))
      OR ((storage.foldername(name))[1] = 'articles' AND has_admin_permission('can_manage_articles'))
      OR ((storage.foldername(name))[1] = 'slides' AND has_admin_permission('can_manage_slides'))
      OR ((storage.foldername(name))[1] = 'popup-banners' AND has_admin_permission('can_manage_popup_banners'))
    )
  );

-- Member upload: HANYA ke requests/{own_uid}/
CREATE POLICY "media_user_upload_requests" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'requests'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND auth.uid() IS NOT NULL
  );

-- Architect/admin delete
CREATE POLICY "media_admin_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'media'
    AND (is_architect() OR is_admin_or_above())
  );

-- Architect/admin update
CREATE POLICY "media_admin_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'media'
    AND (is_architect() OR is_admin_or_above())
  );


-- ============================================================
-- 1k. INDEX PERFORMA
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projects_published_category ON projects (is_published, category_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category_published ON articles (category, is_published);
CREATE INDEX IF NOT EXISTS idx_hero_slides_active_sort ON hero_slides (is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_created ON feedback_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_requests (status);
CREATE INDEX IF NOT EXISTS idx_analytics_project_created ON analytics (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_user_id ON admin_permissions (user_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories (slug);
CREATE INDEX IF NOT EXISTS idx_categories_active_sort ON categories (is_active, sort_order);


-- ============================================================
-- SELESAI! ✅
-- Selanjutnya: deploy Edge Functions, lalu update frontend
-- ============================================================
