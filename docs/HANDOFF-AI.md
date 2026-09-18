# Handoff — Baca Ini Dulu

Dokumen ini menggantikan proses briefing panjang. Kalau kamu AI atau
developer yang baru masuk ke repo ini, baca sampai habis sebelum mengubah
apa pun.

---

## 1. Apa ini

PromptHub: katalog prompt dan tool AI. Pengunjung membuka website untuk
menyalin prompt atau membuka generator; admin mengelola isinya lewat panel
terpisah. Keduanya membaca satu database Supabase yang sama.

Generator interaktif **tidak** ada di dalam repo ini. Masing-masing berdiri
sendiri sebagai halaman statis di GitHub Pages, dan dihubungkan lewat kolom
`projects.tool_url`.

## 2. Stack

- React 19 + Vite, React Router 7
- Supabase: Postgres, Auth, Storage, Edge Functions (Deno)
- Netlify untuk hosting kedua frontend
- Tanpa state manager, tanpa UI library. Ikon dari `lucide-react`.
- CSS biasa dengan custom properties, tanpa Tailwind

## 3. Batas yang tidak boleh dilanggar

**Keamanan**

- `prompthub-web/` dan `prompthub-admin/` dibundel ke browser. Apa pun yang
  ada di sana bisa dibaca pengunjung. Service role key, password database,
  dan JWT secret hanya boleh ada di Edge Function atau Dashboard.
- Semua tabel memakai RLS. Jangan menambal masalah izin dari sisi frontend —
  perbaiki policy-nya di SQL.
- Kolom link yang diisi admin (`external_url`, `link_to`, `link_url`,
  `tool_url`) tidak boleh langsung dipasang ke `href`. Lewatkan dulu ke
  `safeUrl()` di `prompthub-web/src/lib/articleUtils.jsx`; hanya `http://`
  dan `https://` yang boleh lolos.
- Isi artikel dirender jadi elemen React satu per satu lewat `<RichText>`,
  bukan `dangerouslySetInnerHTML`. Jangan diubah jadi injeksi HTML.

**Hemat usage (Supabase free plan: 5 GB egress, 1 GB storage, 500 MB DB)**

- Jangan pakai `select('*')` untuk query daftar. Sebutkan kolomnya.
  `projects.prompt_data` dan `articles.content` berukuran besar dan tidak
  pernah dibutuhkan di halaman daftar.
- Daftar artikel memakai kolom `articles.excerpt` yang diisi otomatis oleh
  trigger database, supaya isi penuh artikel tidak ikut terkirim.
- Upload gambar dari panel sudah dikecilkan di browser dan dikonversi ke
  WebP sebelum dikirim, dengan `cacheControl: 31536000`. Jangan kembalikan
  ke upload mentah.
- Supabase Image Transformation **tidak dipakai** — fitur berbayar dan tiap
  transformasi dihitung egress.

**Anak-anak tangga yang gampang keliru**

- Panel wajib memeriksa `error` dari setiap operasi Supabase dan
  menampilkannya lewat toast. Gagal diam-diam adalah sumber bug tersering
  di project ini: admin mengira sudah tersimpan, padahal database menolak.
- `articles.category` hanya boleh `info-ai` atau `tips`. Sudah dikunci
  constraint.
- Kartu artikel dan tips **selalu** membuka `/artikel/:id`. Link sumber
  muncul sebagai tombol di bagian bawah halaman itu, bukan sebagai tujuan
  klik kartu.

## 4. Peta file penting

**Web pengunjung**

| File | Isi |
|---|---|
| `src/App.jsx` | Definisi rute |
| `src/layouts/UserLayout/UserLayout.jsx` | Header, bottom nav, gerbang login |
| `src/contexts/AuthContext.jsx` | Sesi user dan profil |
| `src/contexts/SettingsContext.jsx` | `site_settings` (logo, nama situs, nomor WA) |
| `src/lib/articleUtils.jsx` | `safeUrl`, `makeExcerpt`, `RichText`, format tanggal |
| `src/components/ArticleCard.jsx` | Kartu Info AI & Tips |
| `src/pages/ArticleDetailPage.jsx` | Halaman baca artikel |
| `src/pages/ToolDetailPage/ToolDetailPage.jsx` | Detail prompt/generator + video tutorial |
| `src/pages/ArticlesPage.css` | Semua gaya kartu artikel & halaman baca |

**Panel admin**

| File | Isi |
|---|---|
| `src/pages/admin/AdminProjects.jsx` | CRUD project + panel atur urutan |
| `src/pages/admin/AdminArticles.jsx` | CRUD artikel (Info AI & Tips) |
| `src/pages/admin/AdminSlides.jsx` | Hero slide, link tujuan berupa dropdown |
| `src/pages/admin/AdminUsers.jsx` | Kelola user, memanggil Edge Function |
| `src/components/Toast.jsx` | Notifikasi, dipakai semua halaman admin |

## 5. Skema database (ringkas)

| Tabel | Kolom yang sering dipakai |
|---|---|
| `projects` | `title`, `description`, `category_id`, `content_type` (`generator`/`copy-paste`), `prompt_data` (jsonb, kunci `prompt_text`), `tool_url`, `thumbnail_url`, `aspect_ratio`, `tutorial_video_url`, `tutorial_aspect_ratio`, `is_published`, `is_featured`, `is_trending`, `sort_order`, `trending_order` |
| `articles` | `title`, `content`, `excerpt` (otomatis), `category` (`info-ai`/`tips`), `thumbnail_url`, `external_url`, `external_button_label`, `is_published` |
| `categories` | `name`, `slug`, `icon`, `sort_order`, `is_active` |
| `hero_slides` | `image_url`, `title`, `tag_text`, `link_to`, `sort_order`, `is_active` |
| `popup_banners` | `title`, `message`, `image_url`, `link_url`, `button_label`, `display_mode` (`once`/`every_login`/`daily`), `start_at`, `end_at` |
| `profiles` | `display_name`, `role` (`architect`/`admin`/`member`), `is_active` |
| `admin_permissions` | Satu baris per admin, kolom `can_manage_*` |
| `feedback_requests` | Request & laporan bug dari user |
| `bookmarks`, `analytics`, `site_settings` | Favorit, statistik, pengaturan situs |

Fungsi bantu di database: `is_architect()`, `has_admin_permission(nama)`,
`public_home_preview()`, `public_tips_preview()`.

Trigger penjaga: `trg_guard_profile_privilege` dan `trg_guard_profile_delete`
melindungi baris akun architect. `trg_fill_article_excerpt` mengisi ringkasan
artikel otomatis.

## 6. Aturan akses

- Pengunjung belum login hanya boleh melihat Homepage, dan itu pun lewat
  fungsi preview yang tidak pernah mengirim `prompt_data` maupun `tool_url`.
- Seluruh isi prompt butuh login.
- `architect` adalah pemilik sistem, jumlahnya satu. Tidak bisa diubah atau
  dihapus oleh siapa pun selain architect lain.
- `admin` mendapat izin per-fitur lewat tabel `admin_permissions`.

## 7. Yang masih terbuka

- Edge Function `admin-delete-user` mengizinkan role `admin` menghapus user
  mana pun. Penghapusan akun architect sudah ditahan trigger database, tapi
  fungsinya sendiri sebaiknya ikut diperketat.
- Artikel belum punya urutan manual seperti project; masih diurutkan tanggal.
- Video tidak ikut dikompres saat upload, hanya gambar.
- Belum ada pagination di halaman Tools; baru dibatasi jumlah maksimal.

## 8. Cara kerja yang diharapkan

1. Ubah source di `prompthub-web/` atau `prompthub-admin/`.
2. Kalau menyentuh database, tambahkan file baru di `supabase/migrations/`
   dengan nomor urut berikutnya. Jangan mengedit file migrasi lama —
   database produksi sudah menjalankannya.
3. Tulis perubahan di `docs/CHANGELOG.md`.
4. Jelaskan di deskripsi commit apa yang berubah dan kenapa.
