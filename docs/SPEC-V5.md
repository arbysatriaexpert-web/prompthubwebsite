# PromptHub — Spec Perbaikan & Fitur Baru

Dokumen ini untuk ditempel ke AI coding tool (Claude Code / Cursor) yang punya akses ke source code repo PromptHub (React + Supabase, deploy di Netlify). Semua temuan di bawah sudah dikonfirmasi lewat inspeksi build JS produksi, bukan tebakan — jadi pakai sebagai fakta dasar, bukan perlu ditemukan ulang dari nol.

## Konteks & fakta yang sudah dikonfirmasi

- Backend: satu Supabase project yang sama dipakai admin panel & user site.
- Tabel yang sudah ada: `projects`, `categories`, `articles`, `hero_slides`, `media`, `profiles`, `feedback_requests`, `site_settings`.
- `projects` punya kolom `prompt_data` (jsonb, isinya `lighting`, `movements`, `template`) plus `prompt_text` dan `aspect_ratio` — **kolom ini tidak dipakai lagi untuk tool baru** (lihat keputusan arsitektur di bawah), tool baru pakai kolom `tool_url` yang mengarah ke file HTML mandiri di GitHub Pages.
- `categories` sudah punya kolom `icon` dan `name`.
- `site_settings` (row tunggal, `id=1`) sudah punya kolom `whatsapp_number` dan `contact_email`, dan fungsi `upsert()` untuk menyimpannya **sudah ada di kode** — tapi tidak ada route admin yang memanggilnya.
- Route admin yang sudah ada: `/admin/articles`, `/admin/categories`, `/admin/projects`, `/admin/requests`, `/admin/slides`, `/admin/users`. **Tidak ada `/admin/settings`.**
- Di `profiles`, hanya ditemukan `.select('*')` dan `.select('role')` — **tidak ada `.update()` atau `.delete()`** pada tabel ini di build admin.
- Class CSS `blur` ada, tapi tidak ditemukan logic pengecekan status login (`isAuthenticated`/`session`) yang mengaktifkannya secara kondisional.

## Bug & fitur yang harus diperbaiki

### 1. Ganti nomor WhatsApp admin dari panel
**Status:** logic backend (`site_settings.whatsapp_number` + fungsi upsert) sudah ada, cuma belum ada halaman admin untuk memakainya.
**Kerjakan:**
- Tambah route `/admin/settings` + item baru di sidebar admin nav.
- Form sederhana: input `whatsapp_number` dan `contact_email`, tombol simpan yang manggil upsert yang sudah ada.
- Pastikan RLS di `site_settings` mengizinkan `update`/`upsert` hanya untuk role admin (cek `profiles.role`), bukan publik.
- Pastikan halaman publik yang menampilkan nomor kontak (tombol WA, footer, dsb) membaca dari `site_settings`, bukan hardcoded di kode.

### 2. Kelola user — tambah edit & hapus
**Status:** hanya ada read (`select`) di tabel `profiles`, belum ada update/delete.
**Kerjakan:**
- Di `/admin/users`, tambah aksi Edit (ubah `role`/status, misalnya aktif/nonaktif) dan Hapus.
- Delete profil sebaiknya soft-delete (kolom status/`is_active`) daripada hard delete, supaya data terkait (project yang dibuat user itu, dsb) tidak jadi yatim.
- Cek RLS: pastikan hanya admin yang boleh update/delete row `profiles` lain, user biasa cuma boleh edit profil sendiri.

### 3. "Kirim ide" tidak masuk ke panel
**Status:** admin panel sudah ada halaman `/admin/requests` yang query `feedback_requests` dengan benar. Tapi build yang saya cek adalah build **admin**, jadi saya belum bisa lihat kode form "kirim ide" di sisi user-site (kemungkinan ada di bundle JS yang berbeda).
**Kerjakan:**
- Cek form "kirim ide" di halaman publik: pastikan benar-benar memanggil `supabase.from('feedback_requests').insert(...)`.
- Cek RLS policy tabel `feedback_requests`: pastikan role `anon`/`authenticated` (bukan cuma admin) diberi izin `INSERT`. Ini penyebab paling umum untuk kasus "keliatan terkirim di form tapi gak muncul di panel" — insert gagal diam-diam karena RLS block, dan error-nya sering tidak ditangani/ditampilkan di UI.
- Tambahkan penanganan error yang jelas di form (kalau insert gagal, user harus lihat pesan error, jangan silent fail).

### 4. Tampilan kategori jadi kotak kecil (icon di atas, nama di bawah)
**Status:** field `icon` dan `name` sudah ada di `categories`, ini murni perubahan tampilan.
**Kerjakan:**
- Ubah komponen kategori di halaman publik jadi grid kotak kecil: icon di tengah-atas, nama di bawahnya.
- Kalau admin belum punya cara upload/pilih icon per kategori, tambahkan itu juga di form `/admin/categories`.

### 5. Blur untuk pengunjung yang belum login
**Status:** class CSS ada tapi tidak dipasang secara kondisional berdasar status auth.
**Kerjakan:**
- Di komponen yang relevan (kemungkinan preview project/generator), cek `session`/`user` dari Supabase auth.
- Kalau belum login: pasang class `blur` pada konten yang harus dikunci, plus overlay CTA "Login untuk lihat lebih lanjut".
- Pastikan ini juga diberlakukan di level data (RLS) kalau kontennya memang harus dibatasi, bukan cuma disembunyikan lewat CSS (CSS blur doang bisa dibuka lewat devtools).

### 6. Dashboard aktivitas tidak sinkron antara panel & web
**Kerjakan (perlu dicek langsung di kode saat sesi berjalan):**
- Bandingkan query yang dipakai `/admin` Dashboard vs counter yang tampil di web publik (kalau ada) — pastikan keduanya query tabel & filter yang sama (misal: dashboard admin menghitung semua row, tapi publik cuma menghitung yang `published=true`, jadi angkanya beda padahal sama-sama "benar" untuk konteks masing-masing — kalau ini yang terjadi, cukup dikasih label yang jelas, bukan dianggap bug).
- Kalau memang keduanya harus sama tapi beda, cek apakah salah satu sisi masih pakai data cache/mock, atau query-nya salah scope (misal kelupaan filter user_id/project_id).

### 7. Fitur baru di homepage
**Susunan section yang diminta (dari atas ke bawah):**
1. (section yang sudah ada di atas)
2. **Galeri hasil generate foto yang lagi tren** — dikurasi manual oleh admin (bukan otomatis). Admin pilih project mana yang tampil di galeri ini.
3. **Tips & trik**
4. **Kotak ide** (paling bawah — posisi sekarang, cuma dipindah ke bawah section baru)

**Kerjakan:**
- Tambah kolom baru di `projects`, misalnya `is_trending` boolean atau tabel kecil terpisah `homepage_gallery` (project_id, urutan tampil) — pilih salah satu, tabel terpisah lebih fleksibel kalau nanti mau atur urutan manual.
- Tambah UI di admin (bisa di halaman `/admin/projects` yang sudah ada, tinggal tambah toggle "Tampilkan di galeri trending") untuk memilih project mana yang masuk galeri ini.
- "Tips & trik" — cek dulu apakah ini bisa reuse tabel `articles` yang sudah ada (filter kategori "tips") daripada bikin tabel baru.

## Rekomendasi arsitektur untuk generator/tools (revisi — keputusan final)

Keputusan final: **tidak pakai skema JSON/relasional generik**, karena struktur tiap prompt generator berbeda-beda antar tool (field, kategori, logic compose-nya beda), jadi maksain satu skema DB malah bikin form admin ribet ngurusin "field mana buat tool mana". Pendekatan yang dipakai sekarang:

1. **Tiap tool = satu file HTML mandiri** (seperti `ugc-generator-v4.html`), di-hosting statis via **GitHub Pages** (bukan Netlify) — jadi nambah/edit tool baru **tidak memakan build minutes Netlify sama sekali**, karena GitHub Pages terpisah dari deploy Netlify utama.
2. **Hapus/jangan pakai lagi kolom `prompt_data` (jsonb)** di tabel `projects` sebagai cara utama menyimpan lighting/movements — itu sumber utama masalah "amburadul" sebelumnya (admin edit JSON mentah, user-tool harus nebak bentuknya). Ganti dengan pendekatan file mandiri di atas.
3. **Tambah kolom baru `tool_url` (text) di tabel `projects`** — isinya link GitHub Pages ke file HTML tool tersebut, contoh: `https://satria-architect.github.io/suki/tools/ugc-v4.html`.
4. **Sederhanakan form admin project** — cukup field yang dipakai buat kartu/listing (`title`, `thumbnail`, `category`, `description`, `tool_url`), tanpa field JSON lighting/movements lagi. Di halaman publik, tombol "Buka Generator" pada card project pakai `<a href={project.tool_url} target="_blank" rel="noopener noreferrer">`.
5. **Struktur repo GitHub**: taruh semua file tool di folder `tools/` (bukan di root repo) supaya rapi seiring jumlah tool bertambah, misal `suki/tools/ugc-v4.html`, `suki/tools/product-review.html`, dst.
6. **Trade-off yang disadari & diterima**: bagian yang seharusnya sama di semua tool (negative prompt standar, watermark, dst.) harus disalin manual ke tiap file HTML — tidak otomatis sinkron antar tool. Ini dianggap dapat diterima karena volumenya belum besar.
7. Kalau ada project lama yang datanya masih di kolom `prompt_data` (jsonb), datanya bisa dibiarkan (tidak perlu migrasi paksa) selama project itu belum dipindah ke file HTML + `tool_url` — cukup pastikan kode baru tidak lagi bergantung pada `prompt_data` untuk project baru.

## Catatan keamanan (RLS)
Anon key memang wajar publik di bundle, tapi itu artinya semua keamanan bergantung ke RLS. Saat mengerjakan poin 1, 2, 3, dan 5 di atas, sekalian audit RLS policy untuk `site_settings`, `profiles`, `feedback_requests`, dan tabel `movements` baru — pastikan hanya admin yang bisa write ke data konfigurasi/user, dan publik hanya bisa insert (bukan update/delete) ke `feedback_requests`.

## Urutan pengerjaan yang disarankan
1. Ganti nomor WA (cepat, logic sudah ada) 
2. Kelola user edit/hapus
3. Perbaiki "kirim ide" + audit RLS
4. Blur untuk belum login
5. Kategori kotak kecil (UI only)
6. Homepage: galeri trending + tips & trik
7. Dashboard sync (butuh investigasi kode langsung)
8. Migrasi arsitektur generator/tools: tambah kolom `tool_url` di `projects`, sederhanakan form admin project, ubah tombol "Buka Generator" di web publik supaya arahkan ke `tool_url` (buka tab baru) — tool-tool barunya sendiri (file HTML + GitHub Pages) dikerjakan manual di luar codebase React ini, jadi bagian ini di kode cuma butuh perubahan kecil
