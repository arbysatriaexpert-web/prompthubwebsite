-- ============================================================
-- PATCH v5.1 — Fix Project & Feedback RLS untuk Architect
-- Jalankan di Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Pastikan kolom is_trending dan logo_url ada
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_trending BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Drop semua policy projects yang lama (bermasalah)
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;

-- 3. Buat ulang policy projects yang LEBIH SIMPEL
-- SELECT: published untuk semua, atau architect/admin
CREATE POLICY "projects_select" ON projects FOR SELECT
  USING (
    is_published = true
    OR is_architect()
    OR has_admin_permission('can_manage_projects')
  );

-- INSERT: architect langsung boleh, admin cek permission
CREATE POLICY "projects_insert" ON projects FOR INSERT
  WITH CHECK (
    is_architect()
    OR has_admin_permission('can_manage_projects')
  );

-- UPDATE: architect langsung boleh, admin cek permission
CREATE POLICY "projects_update" ON projects FOR UPDATE
  USING (
    is_architect()
    OR has_admin_permission('can_manage_projects')
  );

-- DELETE: architect langsung boleh, admin cek permission
CREATE POLICY "projects_delete" ON projects FOR DELETE
  USING (
    is_architect()
    OR has_admin_permission('can_manage_projects')
  );

-- 4. Fix juga untuk categories (sama masalahnya)
DROP POLICY IF EXISTS "categories_select" ON categories;
DROP POLICY IF EXISTS "categories_insert" ON categories;
DROP POLICY IF EXISTS "categories_update" ON categories;
DROP POLICY IF EXISTS "categories_delete" ON categories;

CREATE POLICY "categories_select" ON categories FOR SELECT
  USING (
    is_active = true
    OR is_architect()
    OR has_admin_permission('can_manage_categories')
  );

CREATE POLICY "categories_insert" ON categories FOR INSERT
  WITH CHECK (
    is_architect()
    OR has_admin_permission('can_manage_categories')
  );

CREATE POLICY "categories_update" ON categories FOR UPDATE
  USING (
    is_architect()
    OR has_admin_permission('can_manage_categories')
  );

CREATE POLICY "categories_delete" ON categories FOR DELETE
  USING (
    is_architect()
    OR has_admin_permission('can_manage_categories')
  );

-- 5. Fix feedback_requests — TAMBAH POLICY DELETE (belum ada!)
DROP POLICY IF EXISTS "feedback_delete" ON feedback_requests;
CREATE POLICY "feedback_delete" ON feedback_requests FOR DELETE
  USING (
    is_architect()
    OR has_admin_permission('can_manage_requests')
  );

-- 6. Fix site_settings — tambah upsert support
DROP POLICY IF EXISTS "settings_select" ON site_settings;
DROP POLICY IF EXISTS "settings_update" ON site_settings;
DROP POLICY IF EXISTS "settings_insert" ON site_settings;

CREATE POLICY "settings_select" ON site_settings FOR SELECT
  USING (true);

CREATE POLICY "settings_update" ON site_settings FOR UPDATE
  USING (
    is_architect()
    OR has_admin_permission('can_manage_settings')
  );

CREATE POLICY "settings_insert" ON site_settings FOR INSERT
  WITH CHECK (
    is_architect()
    OR has_admin_permission('can_manage_settings')
  );

-- ============================================================
-- SELESAI! Coba lagi tambah project setelah menjalankan ini.
-- ============================================================
