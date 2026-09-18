-- ============================================================
-- PromptHub — patch v5.5
-- Jalankan di Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: aman dijalankan berulang.
--
-- Isi patch ini:
--   A. Index untuk pagination halaman Tools
--   B. Index untuk hitungan batas feedback harian
--   C. Perbaikan policy UPDATE storage yang kehilangan WITH CHECK
--   D. Batas ukuran file di level bucket (pertahanan terakhir)
--   E. Kueri audit — dijalankan manual, tidak mengubah apa pun
--   F. CATATAN KEAMANAN soal bucket public (perlu keputusan kamu)
-- ============================================================


-- ============================================================
-- A. INDEX UNTUK PAGINATION
-- ============================================================
-- Halaman Tools sekarang memakai .range() dengan urutan
-- (sort_order ASC, created_at DESC) dan filter is_published,
-- ditambah category_id kalau ada chip kategori yang aktif.
--
-- Tanpa index yang cocok, setiap pindah halaman membuat Postgres
-- mengurutkan ulang seluruh tabel lalu membuang barisnya. Dengan
-- index ini, halaman ke-9 sama murahnya dengan halaman pertama.

CREATE INDEX IF NOT EXISTS idx_projects_pub_order
  ON projects (is_published, sort_order ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_pub_cat_order
  ON projects (is_published, category_id, sort_order ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_trending_order
  ON projects (is_published, is_trending, trending_order ASC);

CREATE INDEX IF NOT EXISTS idx_projects_featured_order
  ON projects (is_published, is_featured, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_articles_cat_pub_created
  ON articles (category, is_published, created_at DESC);


-- ============================================================
-- B. INDEX UNTUK BATAS FEEDBACK HARIAN
-- ============================================================
-- Edge Function submit-feedback menghitung jumlah baris milik user
-- untuk hari ini setiap kali ada yang mengirim masukan.

CREATE INDEX IF NOT EXISTS idx_feedback_user_created
  ON feedback_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_status_created
  ON feedback_requests (status, created_at DESC);


-- ============================================================
-- C. PERBAIKAN POLICY UPDATE STORAGE
-- ============================================================
-- Policy "media_admin_update" dibuat dengan USING saja, tanpa
-- WITH CHECK. Untuk perintah UPDATE, Postgres memakai USING untuk
-- memilih baris mana yang boleh disentuh dan WITH CHECK untuk
-- memeriksa nilai barunya. Kalau WITH CHECK tidak ada, Postgres
-- memakai USING sebagai gantinya — kebetulan aman di sini, tapi
-- perilakunya jadi tidak eksplisit dan gampang keliru saat policy
-- ini diubah nanti. Ditulis ulang supaya niatnya jelas.

DROP POLICY IF EXISTS "media_admin_update" ON storage.objects;

CREATE POLICY "media_admin_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'media'
    AND (is_architect() OR is_admin_or_above())
  )
  WITH CHECK (
    bucket_id = 'media'
    AND (is_architect() OR is_admin_or_above())
  );


-- ============================================================
-- D. BATAS UKURAN FILE DI LEVEL BUCKET
-- ============================================================
-- Pertahanan terakhir kalau validasi di browser dilewati (misalnya
-- lewat konsol atau klien lain). 10 MB memberi ruang untuk video
-- thumbnail 8 MB yang diizinkan panel, dan tetap jauh di bawah
-- ambang yang bisa menghabiskan 1 GB storage free plan.
--
-- Kalau nanti kamu memang perlu mengunggah file lebih besar,
-- naikkan angkanya di sini DAN di prompthub-admin/src/lib/uploadLimits.js.

UPDATE storage.buckets
   SET file_size_limit = 10485760   -- 10 MB
 WHERE id = 'media';


-- ============================================================
-- E. KUERI AUDIT — jalankan manual saat mau mengecek pemakaian
-- ============================================================
-- Tidak mengubah apa pun. Salin satu per satu ke SQL Editor.

-- E1. File terbesar di storage (kandidat utama pemakan egress)
--   SELECT name,
--          ROUND((metadata->>'size')::numeric / 1024 / 1024, 2) AS mb,
--          metadata->>'mimetype' AS tipe,
--          created_at
--     FROM storage.objects
--    WHERE bucket_id = 'media'
--    ORDER BY (metadata->>'size')::numeric DESC
--    LIMIT 30;

-- E2. Total storage terpakai per folder
--   SELECT (storage.foldername(name))[1] AS folder,
--          COUNT(*) AS jumlah_file,
--          ROUND(SUM((metadata->>'size')::numeric) / 1024 / 1024, 2) AS total_mb
--     FROM storage.objects
--    WHERE bucket_id = 'media'
--    GROUP BY 1
--    ORDER BY total_mb DESC;

-- E3. File yatim — ada di storage tapi tidak dirujuk baris mana pun.
--     Hapus lewat Dashboard → Storage setelah diperiksa satu per satu.
--   SELECT o.name,
--          ROUND((o.metadata->>'size')::numeric / 1024 / 1024, 2) AS mb
--     FROM storage.objects o
--    WHERE o.bucket_id = 'media'
--      AND (storage.foldername(o.name))[1] <> 'requests'
--      AND NOT EXISTS (SELECT 1 FROM projects       p WHERE p.thumbnail_url LIKE '%' || o.name)
--      AND NOT EXISTS (SELECT 1 FROM articles       a WHERE a.thumbnail_url LIKE '%' || o.name)
--      AND NOT EXISTS (SELECT 1 FROM hero_slides    s WHERE s.image_url     LIKE '%' || o.name)
--      AND NOT EXISTS (SELECT 1 FROM popup_banners  b WHERE b.image_url     LIKE '%' || o.name)
--      AND NOT EXISTS (SELECT 1 FROM categories     c WHERE c.icon          LIKE '%' || o.name)
--      AND NOT EXISTS (SELECT 1 FROM site_settings  t WHERE t.logo_url      LIKE '%' || o.name)
--    ORDER BY mb DESC;

-- E4. Ukuran prompt_data per project (pemakan egress di sisi tabel)
--   SELECT title,
--          pg_size_pretty(pg_column_size(prompt_data)::bigint) AS ukuran
--     FROM projects
--    ORDER BY pg_column_size(prompt_data) DESC
--    LIMIT 20;

-- E5. Lampiran feedback yang sudah selesai ditangani dan bisa dibersihkan
--   SELECT id, type, status, attachment_url, created_at
--     FROM feedback_requests
--    WHERE status = 'done'
--      AND attachment_url IS NOT NULL
--      AND created_at < now() - interval '30 days'
--    ORDER BY created_at;


-- ============================================================
-- F. CATATAN KEAMANAN — BUCKET PUBLIC vs FOLDER requests/
-- ============================================================
-- SENGAJA TIDAK DIJALANKAN OTOMATIS. Baca dulu, putuskan sendiri.
--
-- Masalahnya begini. Panel memakai getPublicUrl() untuk thumbnail dan
-- gambar itu tampil normal di web, artinya bucket `media` disetel
-- Public. Untuk bucket yang Public, endpoint /object/public/ MELEWATI
-- RLS sepenuhnya. Jadi policy "media_public_read" yang membatasi akses
-- ke folder thumbnails/articles/slides/tutorials/popup-banners
-- sebenarnya tidak berlaku untuk pembacaan lewat URL publik — dan
-- folder requests/{user_id}/ yang berisi screenshot laporan user
-- bisa dibuka siapa saja yang tahu path-nya.
--
-- Cek dulu status bucket kamu:
--
--   SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'media';
--
-- Kalau kolom `public` bernilai true, ada dua jalan:
--
-- JALAN 1 (disarankan) — pindahkan lampiran ke bucket privat sendiri.
--   Lampiran feedback memang sudah diakses lewat createSignedUrl di
--   AdminRequests, jadi kodenya hampir tidak perlu diubah: cukup ganti
--   nama bucket di submit-feedback/index.ts dan AdminRequests.jsx.
--
--   INSERT INTO storage.buckets (id, name, public, file_size_limit)
--   VALUES ('feedback', 'feedback', false, 2097152)
--   ON CONFLICT (id) DO UPDATE
--     SET public = false, file_size_limit = 2097152;
--
--   CREATE POLICY "feedback_user_upload" ON storage.objects FOR INSERT
--     WITH CHECK (
--       bucket_id = 'feedback'
--       AND (storage.foldername(name))[1] = auth.uid()::text
--       AND auth.uid() IS NOT NULL
--     );
--
--   CREATE POLICY "feedback_admin_read" ON storage.objects FOR SELECT
--     USING (bucket_id = 'feedback' AND (is_architect() OR is_admin_or_above()));
--
--   CREATE POLICY "feedback_admin_delete" ON storage.objects FOR DELETE
--     USING (bucket_id = 'feedback' AND (is_architect() OR is_admin_or_above()));
--
--   File lama di media/requests/ perlu dipindah manual lewat Dashboard,
--   atau dibiarkan sampai laporan lamanya dihapus.
--
-- JALAN 2 — biarkan seperti sekarang.
--   Risikonya: screenshot yang dikirim user bisa dibuka orang lain yang
--   berhasil menebak atau mendapatkan URL-nya. Path-nya memuat user id
--   dan timestamp acak, jadi tidak gampang ditebak — tapi "sulit ditebak"
--   bukan kontrol akses.
--
-- Yang JANGAN dilakukan: mengubah bucket `media` jadi private tanpa
-- mengganti semua getPublicUrl() menjadi signed URL. Seluruh thumbnail
-- di web akan mati, dan signed URL merusak cache browser karena
-- token-nya berubah tiap kali dibuat.
