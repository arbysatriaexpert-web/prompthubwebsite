# Changelog

## v5.4 — 18 September 2026

### Tampilan artikel & tips

- Kartu Info AI dan Tips dirombak: kotak gambar dikunci rasio 16:9 dengan
  potongan tengah, judul dan ringkasan dipotong pada jumlah baris tetap.
  Tinggi semua kartu jadi identik. Sebelumnya satu thumbnail tinggi (mis.
  screenshot halaman penuh) membuat kartu di sebelahnya melar dan
  menyisakan area kosong besar.
- Artikel tanpa thumbnail sekarang dapat kotak pengganti, bukan ruang kosong.
- Info AI: artikel terbaru tampil sebagai kartu utama dengan gambar lebih
  besar dan ringkasan 3 baris. Tips: aksen kuning dan garis bawah di kotak
  gambar sebagai pembeda.
- Satu kolom di HP, dua kolom di ≥600px, tiga kolom di ≥960px.

### Alur baca artikel

- Kartu **selalu** membuka `/artikel/:id`. Sebelumnya kalau kolom Link
  Sumber terisi, kartu langsung `window.open()` ke situs luar dan halaman
  detail tidak pernah terbuka.
- Susunan halaman baca: gambar → kategori, tanggal, waktu baca → judul →
  isi → tombol ke sumber sebagai penutup → tombol kembali ke daftar.
- Isi artikel dirender dengan penata teks sendiri (`RichText`): `#` sampai
  `####`, daftar `-` dan `1.`, kutipan `>`, `---`, `**tebal**`, `*miring*`,
  `` `kode` ``, `[teks](url)`. Sebelumnya panel menulis "Konten (Markdown)"
  tapi web menampilkannya sebagai teks mentah.
- Tamu yang membuka halaman artikel dapat pesan "Login dulu untuk membaca",
  bukan "Artikel tidak ditemukan" yang menyesatkan.

### Hemat usage Supabase

- Semua query daftar berhenti memakai `select('*')`. Home, Tools, Info AI,
  Tips, dan Favorit sekarang hanya menarik kolom yang ditampilkan.
  `prompt_data` dan `articles.content` tidak lagi ikut terkirim.
- Kolom `articles.excerpt` baru, diisi otomatis oleh trigger dari kalimat
  pertama isi artikel. Daftar artikel membaca kolom ini.
- Daftar artikel dibatasi 40 baris, halaman Tools dibatasi kolomnya.
- Upload gambar dari panel dikecilkan di browser dan dikonversi ke WebP
  sebelum dikirim. Batas lebar: ikon & logo 256px, thumbnail project &
  banner 900px, gambar artikel 1200px, slide 1400px. Kalau hasil kompresi
  lebih besar dari aslinya, file asli yang dipakai.
- `cacheControl` upload dinaikkan dari 1 jam jadi 1 tahun. File lama ikut
  diperbaiki lewat SQL.
- Semua gambar kartu pakai `loading="lazy"`.
- Baris `analytics` lebih dari 90 hari dihapus.

### Keamanan

- Baris akun architect sekarang hanya bisa diubah architect. Sebelumnya
  admin ber-izin "kelola user" bisa menyetel `is_active = false` pada akun
  architect dan mengunci pemilik keluar dari panelnya sendiri.
- Penghapusan akun architect diblokir trigger `trg_guard_profile_delete`,
  termasuk lewat Edge Function yang memakai service role.
- Kolom link disaring `safeUrl()` di frontend dan constraint di database;
  hanya `http://` dan `https://` yang lolos. Sebelumnya isi
  `javascript:...` dari panel akan dijalankan browser pengunjung.
- `articles.category` dikunci constraint ke `info-ai` / `tips`. Sebelumnya
  satu typo membuat artikel tidak pernah muncul di web tanpa pesan error.

### Panel

- Kelola Artikel dan Hero Slides sekarang memeriksa hasil simpan, hapus,
  dan upload, lalu menampilkan pesan asli dari Supabase lewat toast.
  Sebelumnya gagal diam-diam — form tetap tertutup seolah berhasil.
- Link slide yang diketik tanpa garis miring di depan dirapikan otomatis.
- Kolom `articles.updated_at` dipastikan ada. Panel selalu mengirimnya;
  kalau kolomnya belum dibuat, **semua** penyimpanan artikel gagal.
- `public_tips_preview()` ikut mengirim ringkasan, sehingga kartu Tips di
  Home tidak kosong untuk pengunjung yang belum login.
- `public_home_preview()` dinaikkan dari 12 ke 24 baris supaya tampilan
  tamu tidak berbeda dari tampilan setelah login.

---

## v5.3

- Frame video tutorial dipisah dari rasio kartu thumbnail
  (`tutorial_aspect_ratio`).
- Video tutorial memakai pendekatan thumbnail + tombol play sendiri;
  iframe baru dipasang setelah diklik.
- Urutan halaman detail tool dirapikan: judul, video, deskripsi, prompt,
  lapor bug.
- Halaman detail artikel (`/artikel/:id`) dibuat; sebelumnya kartu artikel
  tidak bisa diklik sama sekali.
- Frekuensi popup banner bisa dipilih: sekali, setiap login, sekali per hari.
- Urutan project bisa diatur manual dari panel (`sort_order`,
  `trending_order`).
- Link tujuan hero slide jadi dropdown berisi halaman, tool, dan artikel.
- Keamanan: member tidak bisa lagi menaikkan dirinya jadi architect; gerbang
  login diberlakukan di level database, bukan hanya efek blur di UI.

## v5.2

- Branding situs (logo, nama) lewat `site_settings`.
- Kolom `tool_url`, `tutorial_video_url`, `prompt_data`, `is_trending`.
- `content_type` disederhanakan jadi `generator` / `copy-paste`.
- Perbaikan policy storage untuk admin non-architect.

## v5.1

- Sistem izin admin per-fitur lewat `admin_permissions`.
- Popup banner dan feedback request.
