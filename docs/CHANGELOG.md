# Changelog

## v5.5 — 18 September 2026

Fokus rilis ini: memangkas egress Supabase supaya free plan (5 GB/bulan)
cukup, plus dua perbaikan bug yang dilaporkan.

### Egress — yang paling berdampak

- **Thumbnail video di kartu tidak lagi `<video autoPlay>` polos.** Ini pos
  pemborosan terbesar yang ditemukan: setiap video thumbnail diunduh utuh,
  untuk setiap kartu, setiap kali halaman dibuka. Sepuluh kartu video 3 MB
  berarti 30 MB sekali muat. Sekarang video baru diunduh setelah kartunya
  benar-benar masuk layar, lalu disimpan di device — kunjungan berikutnya
  nol byte. Berlaku di Home, Tools, slide carousel, dan daftar Favorit.
- **Upload dari panel akhirnya benar-benar dikompres.** `HANDOFF-AI.md`
  sudah menyatakan gambar dikecilkan ke WebP dengan `cacheControl` satu
  tahun, tapi kodenya tidak pernah ada — file diunggah mentah tanpa
  `cacheControl` sama sekali. Karena default Supabase cuma 3600 detik,
  browser pengunjung menanyakan ulang setiap file media tiap jam. Sekarang
  gambar dikecilkan maksimal 1600 px, dikonversi ke WebP, dan diunggah
  dengan umur cache satu tahun.
- **Halaman Tools memakai pagination di sisi server.** Sebelumnya seluruh
  baris `projects` yang published diambil sekaligus tanpa `.limit()`, lalu
  difilter kategori di browser. Sekarang 12 baris per halaman lewat
  `.range()`, filter kategori dikerjakan database.
- **Hasil query disimpan di device** dengan pola stale-while-revalidate.
  Bolak-balik antar halaman tidak lagi mengirim query baru setiap kali.
  `site_settings` yang tadinya dibaca tiga kali per pemuatan halaman
  sekarang dibaca sekali per enam jam.
- **Video tutorial di halaman detail baru diunduh setelah tombol play
  ditekan.** `preload="metadata"` sebelumnya tetap menarik data untuk setiap
  pengunjung yang membuka halaman, termasuk yang tidak berniat menonton.

### Ukuran bundel

- Code splitting per halaman dengan `React.lazy` di web maupun panel.
  Pengunjung yang hanya membuka Home tidak lagi mengunduh kode seluruh
  halaman lain. Panel paling untung: admin yang cuma mengurus artikel
  dulunya tetap mengunduh kode halaman user, kategori, slide, dan popup.
- `lazyWithRetry` menangani kasus tab lama + deploy baru: nama chunk
  berubah, import gagal, halaman dimuat ulang sekali otomatis. Tanpa ini,
  code splitting menghasilkan layar putih setiap kali ada deploy.
- Vendor dipisah jadi chunk sendiri (`react`, `router`, `supabase`,
  `icons`), jadi tetap terpakai dari cache browser setelah deploy baru.
- `netlify.toml` kedua app: `/assets/*` di-cache satu tahun dengan
  `immutable`, `index.html` `must-revalidate`. Ditambah header keamanan
  dasar; panel admin juga `X-Frame-Options: DENY` dan `noindex`.

### Perbaikan bug

- **Preview upload di panel tidak muncul setelah file dipilih.** Akarnya
  tiga, semuanya diperbaiki sekaligus lewat komponen `MediaUploadField`:
  (1) preview dulu hanya dirender setelah upload ke Supabase selesai, jadi
  selama menunggu layar kosong — sekarang preview muncul seketika dari file
  lokal, tidak menyentuh jaringan sama sekali; (2) halaman Slides, Popup
  Banner, dan Kategori cuma menulis `if (!error) { ... }` tanpa cabang else,
  jadi upload yang ditolak RLS lewat tanpa pesan apa pun — sekarang setiap
  error dilaporkan lewat toast dengan pesan asli Supabase; (3) `AdminCrud.css`
  hanya punya aturan ukuran untuk `img`, tidak untuk `video`, sehingga
  preview video melar atau gepeng.
- Memilih file yang sama dua kali berturut-turut sekarang tetap memicu
  `onChange`. Sebelumnya nilai input tidak direset, jadi hapus lampiran lalu
  pilih file yang sama terasa seperti tombolnya rusak. Berlaku di panel
  maupun form masukan di web.

### Batas ukuran

- Lampiran masukan dari user turun dari 5 MB jadi **2 MB** untuk video,
  menyamai batas foto. Lampiran dikirim sebagai base64 yang membengkak ~33%,
  jadi video 5 MB berarti body request ~6,7 MB — dan file itu diunduh lagi
  oleh admin lewat signed URL. Diubah di `AkunPage.jsx` dan
  `submit-feedback/index.ts`; keduanya harus selalu sama.
- Batas upload panel dibuat eksplisit: gambar 5 MB, video 8 MB, ditambah
  batas 10 MB di level bucket lewat SQL sebagai pertahanan terakhir.

### Panel

- Halaman Pengaturan punya kotak **Cache di Device Ini**: status penyimpanan
  permanen, jumlah dan ukuran file tersimpan, serta tanggal kedaluwarsa per
  file. Ada juga tombol untuk meminta penyimpanan permanen dan membersihkan
  cache.
- Daftar data di panel sengaja **tidak** di-cache. Panel adalah tempat data
  diubah; daftar yang di-cache akan membuat admin melihat data lama sesudah
  menyimpan dan mengira gagal — persis jenis bug yang sudah beberapa kali
  muncul di project ini. Yang di-cache di panel hanya media dan
  `site_settings`, dan yang terakhir dibuang cache-nya tepat setelah Simpan.

### Database

- Index untuk pagination (`is_published, sort_order, created_at` dan
  variannya dengan `category_id`) supaya halaman ke-9 sama murahnya dengan
  halaman pertama.
- Index untuk hitungan batas feedback harian.
- Policy `media_admin_update` ditulis ulang dengan `WITH CHECK` yang
  eksplisit. Sebelumnya hanya ada `USING`; Postgres memakainya sebagai
  pengganti, kebetulan aman, tapi perilakunya tidak eksplisit.

### Belum dikerjakan

- `AdminProjects` masih menarik `prompt_data` untuk semua baris di daftar.
- Lampiran feedback kemungkinan bisa diakses publik kalau bucket `media`
  disetel Public — endpoint `/object/public/` melewati RLS, jadi policy
  pembatas folder tidak berlaku untuk pembacaan lewat URL publik.
  Penjelasan dan dua jalan keluarnya ada di bagian F `06_patch_v5.5.sql`.
- Video tetap tidak dikompres saat upload, hanya gambar.

---

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
