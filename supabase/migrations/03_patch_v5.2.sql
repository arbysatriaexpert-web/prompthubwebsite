-- ============================================================
-- PATCH v5.2 — PromptHub
-- Jalankan di Supabase Dashboard → SQL Editor → New Query → Run
-- Aman dijalankan berulang (idempotent).
-- Prasyarat: supabase_migration_v5_up.sql dan supabase_patch_v5.1.sql
--            sudah pernah dijalankan.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. KOLOM YANG DIBUTUHKAN STRUKTUR BARU
-- ────────────────────────────────────────────────────────────

-- Branding: nama situs + logo (dipakai navbar admin & web user)
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS logo_url  TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS site_name TEXT DEFAULT 'PromptHub';

-- Pastikan baris tunggal id=1 benar-benar ada.
-- Tanpa baris ini, upsert dari panel bisa gagal diam-diam.
INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Kolom project yang dipakai arsitektur v5
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tool_url            TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tutorial_video_url  TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS prompt_data         JSONB DEFAULT '{}'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_trending         BOOLEAN NOT NULL DEFAULT false;

-- Jangan biarkan prompt_data NULL — kode membaca prompt_data->>'prompt_text'
UPDATE projects SET prompt_data = '{}'::jsonb WHERE prompt_data IS NULL;


-- ────────────────────────────────────────────────────────────
-- 2. MIGRASI DATA PROMPT LAMA → prompt_data.prompt_text
--    (hanya jalan kalau kolom lama `prompt_text` memang ada)
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'prompt_text'
  ) THEN
    UPDATE projects
    SET prompt_data = jsonb_set(
          COALESCE(prompt_data, '{}'::jsonb),
          '{prompt_text}',
          to_jsonb(prompt_text)
        )
    WHERE prompt_text IS NOT NULL
      AND prompt_text <> ''
      AND COALESCE(prompt_data->>'prompt_text', '') = '';
    RAISE NOTICE 'Prompt lama dari kolom prompt_text sudah disalin ke prompt_data.';
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- 3. RAPIKAN content_type — hapus opsi 'article' yang tidak dipakai
-- ────────────────────────────────────────────────────────────

-- Pindahkan sisa data bertipe 'article' (kalau ada) ke copy-paste
UPDATE projects SET content_type = 'copy-paste' WHERE content_type = 'article';

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_content_type_check;
ALTER TABLE projects ADD CONSTRAINT projects_content_type_check
  CHECK (content_type IN ('generator', 'copy-paste'));


-- ────────────────────────────────────────────────────────────
-- 4. FIX STORAGE: admin dengan izin "Pengaturan" harus bisa upload logo
--    Sebelumnya folder thumbnails/ hanya terbuka untuk
--    can_manage_projects, jadi upload logo dari halaman Pengaturan
--    gagal untuk admin non-architect.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "media_admin_upload" ON storage.objects;
CREATE POLICY "media_admin_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'media'
    AND (
      ((storage.foldername(name))[1] = 'thumbnails'
        AND (has_admin_permission('can_manage_projects')
          OR has_admin_permission('can_manage_settings')))
      OR ((storage.foldername(name))[1] = 'tutorials'      AND has_admin_permission('can_manage_projects'))
      OR ((storage.foldername(name))[1] = 'articles'       AND has_admin_permission('can_manage_articles'))
      OR ((storage.foldername(name))[1] = 'slides'         AND has_admin_permission('can_manage_slides'))
      OR ((storage.foldername(name))[1] = 'popup-banners'  AND has_admin_permission('can_manage_popup_banners'))
    )
  );


-- ────────────────────────────────────────────────────────────
-- 5. PASTIKAN RLS site_settings BENAR
--    settings_select harus terbuka untuk anon — kalau tidak,
--    logo & nomor WA tidak muncul di web user yang belum login.
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "settings_select" ON site_settings;
CREATE POLICY "settings_select" ON site_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "settings_update" ON site_settings;
CREATE POLICY "settings_update" ON site_settings FOR UPDATE
  USING (is_architect() OR has_admin_permission('can_manage_settings'))
  WITH CHECK (is_architect() OR has_admin_permission('can_manage_settings'));

DROP POLICY IF EXISTS "settings_insert" ON site_settings;
CREATE POLICY "settings_insert" ON site_settings FOR INSERT
  WITH CHECK (is_architect() OR has_admin_permission('can_manage_settings'));


-- ────────────────────────────────────────────────────────────
-- 6. INDEX untuk section homepage
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_projects_featured
  ON projects (is_published, is_featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_trending
  ON projects (is_published, is_trending, created_at DESC);


-- ============================================================
-- SELESAI
-- ============================================================
