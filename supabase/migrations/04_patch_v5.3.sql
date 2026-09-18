-- ============================================================
-- PATCH v5.3 — PromptHub
-- Supabase Dashboard -> SQL Editor -> New query -> tempel semua -> Run
-- Aman dijalankan berulang kali (idempotent).
--
-- Prasyarat: v5_up + patch v5.1 + patch v5.2 sudah dijalankan.
-- Patch ini berisi FITUR BARU + PENAMBALAN 3 CELAH KEAMANAN.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BAGIAN A — KOLOM BARU
-- ════════════════════════════════════════════════════════════

-- A1. Urutan tampil project (bisa diatur manual dari panel)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS trending_order INTEGER NOT NULL DEFAULT 0;

-- A2. Frame video tutorial, terpisah dari rasio kartu thumbnail
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tutorial_aspect_ratio TEXT DEFAULT '16:9';
UPDATE projects SET tutorial_aspect_ratio = '16:9'
  WHERE tutorial_aspect_ratio IS NULL OR tutorial_aspect_ratio = '';

-- A3. Mode tampil popup banner
--     once        = sekali seumur akun (setelah ditutup tidak muncul lagi)
--     every_login = setiap kali user login / buka sesi baru
--     daily       = maksimal sekali per hari  (perilaku lama)
ALTER TABLE popup_banners ADD COLUMN IF NOT EXISTS display_mode TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE popup_banners DROP CONSTRAINT IF EXISTS popup_display_mode_check;
ALTER TABLE popup_banners ADD CONSTRAINT popup_display_mode_check
  CHECK (display_mode IN ('once', 'every_login', 'daily'));

-- A4. Backfill urutan awal berdasarkan tanggal dibuat, biar tidak semua nol
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn FROM projects
)
UPDATE projects p SET sort_order = r.rn
FROM ranked r WHERE p.id = r.id AND p.sort_order = 0;

WITH ranked_trend AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
  FROM projects WHERE is_trending = true
)
UPDATE projects p SET trending_order = r.rn
FROM ranked_trend r WHERE p.id = r.id AND p.trending_order = 0;


-- ════════════════════════════════════════════════════════════
-- BAGIAN B — CELAH KEAMANAN #1 (PALING BERBAHAYA)
-- Eskalasi hak akses: member biasa bisa menaikkan dirinya
-- sendiri jadi architect lewat satu panggilan API.
--
-- Policy lama "profiles_update_own" hanya mengecek id = auth.uid(),
-- tidak mengecek kolom role. Jadi siapa pun yang punya akun bisa
-- menjalankan update role='architect' pada barisnya sendiri dan
-- langsung mendapat akses penuh ke seluruh sistem.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION guard_profile_privilege_change()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
  old_active TEXT;
  new_active TEXT;
BEGIN
  -- service_role (Edge Function) tidak punya auth.uid() -> dilewati.
  -- Aman karena service key hanya dipakai di server, tidak di browser.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO actor_role FROM profiles WHERE id = auth.uid();

  -- Architect boleh mengubah apa saja
  IF actor_role = 'architect' THEN
    RETURN NEW;
  END IF;

  -- Selain architect: role TIDAK BOLEH berubah, termasuk role sendiri
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Ditolak: hanya architect yang boleh mengubah role akun.';
  END IF;

  -- is_active hanya boleh diubah admin yang punya izin kelola user
  old_active := to_jsonb(OLD) ->> 'is_active';
  new_active := to_jsonb(NEW) ->> 'is_active';
  IF new_active IS DISTINCT FROM old_active
     AND NOT has_admin_permission('can_manage_users') THEN
    RAISE EXCEPTION 'Ditolak: tidak punya izin mengubah status aktif akun.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_profile_privilege ON profiles;
CREATE TRIGGER trg_guard_profile_privilege
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_profile_privilege_change();

-- Perketat juga policy update-nya
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  USING (is_architect() OR has_admin_permission('can_manage_users'))
  WITH CHECK (is_architect() OR has_admin_permission('can_manage_users'));


-- ════════════════════════════════════════════════════════════
-- BAGIAN C — CELAH KEAMANAN #2
-- Gerbang login cuma hiasan.
--
-- Policy lama: projects_select USING (is_published = true ...)
-- tanpa syarat login. Artinya pengunjung yang belum login bisa
-- menarik SELURUH isi prompt dan tool_url langsung lewat anon key
-- yang terlihat di source JavaScript. Efek blur di web user cuma
-- CSS, tidak melindungi data sama sekali.
--
-- Perbaikan: baca penuh wajib login. Untuk Home yang memang boleh
-- dilihat tamu, disediakan fungsi preview yang hanya mengembalikan
-- judul + thumbnail (TANPA prompt_data, TANPA tool_url).
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select" ON projects FOR SELECT
  USING (
    (is_published = true AND auth.uid() IS NOT NULL)
    OR is_architect()
    OR has_admin_permission('can_manage_projects')
  );

DROP POLICY IF EXISTS "articles_select" ON articles;
CREATE POLICY "articles_select" ON articles FOR SELECT
  USING (
    (is_published = true AND auth.uid() IS NOT NULL)
    OR is_architect()
    OR has_admin_permission('can_manage_articles')
  );

-- Preview aman untuk tamu di Homepage (tanpa data berharga)
CREATE OR REPLACE FUNCTION public_home_preview()
RETURNS TABLE (
  id             UUID,
  title          TEXT,
  thumbnail_url  TEXT,
  aspect_ratio   TEXT,
  content_type   TEXT,
  category_name  TEXT,
  is_featured    BOOLEAN,
  is_trending    BOOLEAN,
  sort_order     INTEGER,
  trending_order INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.title, p.thumbnail_url, p.aspect_ratio, p.content_type,
         c.name, p.is_featured, p.is_trending, p.sort_order, p.trending_order
  FROM projects p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.is_published = true
    AND (p.is_featured = true OR p.is_trending = true)
  ORDER BY p.sort_order ASC, p.created_at DESC
  LIMIT 12;
$$;

CREATE OR REPLACE FUNCTION public_tips_preview()
RETURNS TABLE (
  id            UUID,
  title         TEXT,
  thumbnail_url TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.title, a.thumbnail_url, a.created_at
  FROM articles a
  WHERE a.is_published = true AND a.category = 'tips'
  ORDER BY a.created_at DESC
  LIMIT 3;
$$;

REVOKE ALL ON FUNCTION public_home_preview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public_tips_preview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_home_preview() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public_tips_preview() TO anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- BAGIAN D — CELAH KEAMANAN #3
-- Admin ber-izin "kelola user" bisa mengangkat dirinya sendiri
-- jadi architect. Sudah ditutup oleh trigger di Bagian B,
-- tapi kunci kedua ditambahkan di tingkat constraint agar
-- role liar tidak bisa masuk sama sekali.
-- ════════════════════════════════════════════════════════════

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('architect', 'admin', 'member'));

-- Pastikan hanya ada satu architect (akun kamu).
-- Jalankan query ini untuk melihat siapa saja yang architect:
--   SELECT id, display_name, role FROM profiles WHERE role = 'architect';


-- ════════════════════════════════════════════════════════════
-- BAGIAN E — SINKRONISASI POLICY YANG TERLEWAT
-- Beberapa policy lupa menyertakan is_architect(), sehingga
-- architect bisa tertolak kalau baris admin_permissions-nya kosong.
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "categories_insert" ON categories;
CREATE POLICY "categories_insert" ON categories FOR INSERT
  WITH CHECK (is_architect() OR has_admin_permission('can_manage_categories'));
DROP POLICY IF EXISTS "categories_update" ON categories;
CREATE POLICY "categories_update" ON categories FOR UPDATE
  USING (is_architect() OR has_admin_permission('can_manage_categories'))
  WITH CHECK (is_architect() OR has_admin_permission('can_manage_categories'));
DROP POLICY IF EXISTS "categories_delete" ON categories;
CREATE POLICY "categories_delete" ON categories FOR DELETE
  USING (is_architect() OR has_admin_permission('can_manage_categories'));

DROP POLICY IF EXISTS "projects_insert" ON projects;
CREATE POLICY "projects_insert" ON projects FOR INSERT
  WITH CHECK (is_architect() OR has_admin_permission('can_manage_projects'));
DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update" ON projects FOR UPDATE
  USING (is_architect() OR has_admin_permission('can_manage_projects'))
  WITH CHECK (is_architect() OR has_admin_permission('can_manage_projects'));
DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_delete" ON projects FOR DELETE
  USING (is_architect() OR has_admin_permission('can_manage_projects'));

DROP POLICY IF EXISTS "articles_insert" ON articles;
CREATE POLICY "articles_insert" ON articles FOR INSERT
  WITH CHECK (is_architect() OR has_admin_permission('can_manage_articles'));
DROP POLICY IF EXISTS "articles_update" ON articles;
CREATE POLICY "articles_update" ON articles FOR UPDATE
  USING (is_architect() OR has_admin_permission('can_manage_articles'))
  WITH CHECK (is_architect() OR has_admin_permission('can_manage_articles'));
DROP POLICY IF EXISTS "articles_delete" ON articles;
CREATE POLICY "articles_delete" ON articles FOR DELETE
  USING (is_architect() OR has_admin_permission('can_manage_articles'));

DROP POLICY IF EXISTS "slides_insert" ON hero_slides;
CREATE POLICY "slides_insert" ON hero_slides FOR INSERT
  WITH CHECK (is_architect() OR has_admin_permission('can_manage_slides'));
DROP POLICY IF EXISTS "slides_update" ON hero_slides;
CREATE POLICY "slides_update" ON hero_slides FOR UPDATE
  USING (is_architect() OR has_admin_permission('can_manage_slides'))
  WITH CHECK (is_architect() OR has_admin_permission('can_manage_slides'));
DROP POLICY IF EXISTS "slides_delete" ON hero_slides;
CREATE POLICY "slides_delete" ON hero_slides FOR DELETE
  USING (is_architect() OR has_admin_permission('can_manage_slides'));

DROP POLICY IF EXISTS "popup_insert" ON popup_banners;
CREATE POLICY "popup_insert" ON popup_banners FOR INSERT
  WITH CHECK (is_architect() OR has_admin_permission('can_manage_popup_banners'));
DROP POLICY IF EXISTS "popup_update" ON popup_banners;
CREATE POLICY "popup_update" ON popup_banners FOR UPDATE
  USING (is_architect() OR has_admin_permission('can_manage_popup_banners'))
  WITH CHECK (is_architect() OR has_admin_permission('can_manage_popup_banners'));
DROP POLICY IF EXISTS "popup_delete" ON popup_banners;
CREATE POLICY "popup_delete" ON popup_banners FOR DELETE
  USING (is_architect() OR has_admin_permission('can_manage_popup_banners'));

DROP POLICY IF EXISTS "feedback_update" ON feedback_requests;
CREATE POLICY "feedback_update" ON feedback_requests FOR UPDATE
  USING (is_architect() OR has_admin_permission('can_manage_requests'))
  WITH CHECK (is_architect() OR has_admin_permission('can_manage_requests'));
DROP POLICY IF EXISTS "feedback_delete" ON feedback_requests;
CREATE POLICY "feedback_delete" ON feedback_requests FOR DELETE
  USING (is_architect() OR has_admin_permission('can_manage_requests'));

DROP POLICY IF EXISTS "analytics_insert" ON analytics;
CREATE POLICY "analytics_insert" ON analytics FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND action_type IN ('copy', 'generate', 'view', 'open_tool')
  );


-- ════════════════════════════════════════════════════════════
-- BAGIAN F — INDEX UNTUK URUTAN BARU
-- ════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_projects_sort
  ON projects (is_published, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_trending_order
  ON projects (is_published, is_trending, trending_order);


-- ============================================================
-- SELESAI.
--
-- CEK HASIL (opsional, jalankan terpisah):
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='projects'
--     AND column_name IN ('sort_order','trending_order','tutorial_aspect_ratio');
--   -- harus keluar 3 baris
--
--   SELECT id, display_name, role FROM profiles WHERE role='architect';
--   -- pastikan hanya akun kamu
-- ============================================================
