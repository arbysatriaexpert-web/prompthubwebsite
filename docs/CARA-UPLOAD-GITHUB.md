# Cara Upload ke GitHub

Panduan ini ditulis untuk yang belum pernah pakai GitHub sama sekali.
Ikuti dari atas ke bawah, jangan dilompati.

---

# Bagian 1 — Siapkan akun & repository

## 1.1 Buat akun GitHub

Kalau sudah punya, lompat ke 1.2.

1. Buka https://github.com/signup
2. Isi email, password, dan username
3. Verifikasi lewat email yang masuk

## 1.2 Buat repository baru

1. Login ke GitHub
2. Klik tanda **+** di pojok kanan atas → **New repository**
3. Isi:
   - **Repository name**: `prompthub`
   - **Description**: `Katalog prompt dan tool AI` (opsional)
   - Pilih **Private**
   - **JANGAN** centang "Add a README file"
   - **JANGAN** centang "Add .gitignore"
   - **JANGAN** pilih license
4. Klik **Create repository**

Tiga "jangan" di atas penting. Kalau dicentang, repo terisi duluan dan
upload pertama kamu akan bentrok.

Setelah dibuat kamu akan lihat halaman berisi perintah-perintah. Abaikan
dulu, jangan ditutup — alamat repo-nya akan dipakai nanti.

---

# Bagian 2 — Upload isi project

Ada dua cara. **Cara A** paling gampang tapi hanya enak untuk upload
pertama. **Cara B** butuh install sekali, tapi jauh lebih enak untuk
perbaikan sehari-hari. Saran: pakai Cara A sekarang, lalu pasang Cara B
setelahnya.

## Cara A — Lewat browser, tanpa install apa pun

### A.1 Siapkan foldernya

1. Extract file `prompthub-github-v5.4.zip` yang kamu terima
2. Kamu akan dapat satu folder bernama `prompthub`
3. Buka folder itu. Isinya harus seperti ini:

```
prompthub/
├── README.md
├── .gitignore
├── deploy/
├── docs/
├── prompthub-admin/
├── prompthub-web/
└── supabase/
```

Kalau di dalam `prompthub-web/` atau `prompthub-admin/` ada folder
**`node_modules`**, **hapus dulu**. Isinya puluhan ribu file dan tidak boleh
ikut diupload. Folder itu dibuat ulang otomatis saat build.

### A.2 Upload

1. Di halaman repo GitHub yang tadi, cari tulisan **uploading an existing file**
   (ada di kalimat "…or push an existing repository…"), klik itu.
   Kalau tidak ketemu, buka alamat ini di browser dan ganti `USERNAME`:
   `https://github.com/USERNAME/prompthub/upload/main`
2. Buka File Explorer, masuk ke dalam folder `prompthub`
3. Blok **semua isinya** (Ctrl + A) — file dan folder, tapi **bukan** folder
   `prompthub` itu sendiri
4. Drag semuanya ke area putih bertuliskan "Drag files here"
5. Tunggu sampai semua ter-upload. Ini bisa beberapa menit, jangan tutup tab
6. Di kotak bawah, tulis di kolom pertama: `PromptHub v5.4`
7. Klik **Commit changes**

### A.3 Periksa hasilnya

Buka halaman utama repo. Pastikan:

- [ ] Folder `prompthub-web`, `prompthub-admin`, `supabase`, `docs`, `deploy` ada
- [ ] `README.md` tampil isinya di bawah daftar file
- [ ] **Tidak ada** folder `node_modules`
- [ ] **Tidak ada** file bernama `.env` (yang boleh ada cuma `.env.example`)

Kalau ada `.env` yang keikut, klik file itu → ikon tong sampah → Commit.
Lalu segera ganti anon key-nya di Supabase Dashboard → Settings → API.

> **Kenapa?** Upload lewat browser **tidak membaca** file `.gitignore`.
> Jadi apa pun yang kamu drag akan naik, termasuk file rahasia. Paket yang
> kamu terima sudah saya bersihkan dari `.env`, tapi tetap dicek ya.

---

## Cara B — GitHub Desktop (untuk perbaikan sehari-hari)

Setelah ini terpasang, setiap perubahan cukup 3 klik. Dan `.gitignore`
benar-benar dipatuhi, jadi tidak ada risiko file rahasia keikut.

### B.1 Install

1. Download di https://desktop.github.com
2. Install, buka, lalu **Sign in to GitHub.com**
3. Login pakai akun yang tadi

### B.2 Sambungkan ke repo

**Kalau kamu sudah upload lewat Cara A:**

1. **File** → **Clone repository**
2. Tab **GitHub.com** → pilih `prompthub`
3. **Local path**: pilih lokasi di komputermu, misal `D:\project`
4. Klik **Clone**

Hasilnya kamu dapat folder `D:\project\prompthub`. **Mulai sekarang, folder
inilah yang kamu edit**, bukan folder lama.

**Kalau kamu langsung mulai dari Cara B (belum upload apa-apa):**

1. **File** → **Add local repository** → pilih folder `prompthub` hasil extract
2. Muncul peringatan "not a git repository" → klik **create a repository**
3. Klik **Create repository**
4. Klik tombol **Publish repository** di atas
5. Centang **Keep this code private** → **Publish repository**

### B.3 Cara mengirim perubahan

Setiap kali selesai mengedit file:

1. Buka GitHub Desktop — perubahannya muncul sendiri di daftar kiri
2. Di kotak kiri bawah, tulis ringkas apa yang berubah.
   Contoh: `Perbaiki tampilan kartu tips`
3. Klik **Commit to main**
4. Klik **Push origin** di bagian atas

Selesai. Perubahan sudah ada di GitHub.

---

# Bagian 3 — Cara pakai repo ini dengan AI

Tujuanmu supaya tidak perlu kirim-kirim file zip lagi. Ada dua pilihan.

## Pilihan 1 — Repo tetap private (lebih aman)

Sebagian besar AI coding tool bisa diberi akses ke repo private lewat
integrasi GitHub. Kamu login GitHub di tool-nya, pilih repo `prompthub`,
selesai — tidak perlu dibuat public sama sekali.

Kalau AI yang kamu pakai mendukung ini, pakai cara ini.

## Pilihan 2 — Public sementara

Kalau AI-nya cuma bisa baca repo public, rencanamu (public → minta bantuan →
private lagi) bisa jalan. Tapi ada yang perlu kamu tahu:

**Begitu repo pernah public, isinya bisa sudah tersalin oleh pihak lain dan
tidak bisa ditarik kembali.** Mengembalikan ke private menutup akses baru,
tapi salinan yang terlanjur diambil tetap ada.

Untuk repo ini risikonya kecil, asal:

- Tidak ada file `.env` di dalamnya
- Tidak ada service role key, password database, atau JWT secret di mana pun
- Anon key Supabase boleh terlihat — memang dirancang publik, dan
  perlindungannya ada di Row Level Security, bukan di kerahasiaan key

Cara ganti visibility:

1. Repo → tab **Settings**
2. Scroll ke bawah sampai **Danger Zone**
3. **Change repository visibility** → pilih Public atau Private
4. Ketik nama repo untuk konfirmasi

**Sebelum** menjadikannya public, cek ulang: buka repo, pastikan tidak ada
file `.env`, dan buka `prompthub-web/` dan `prompthub-admin/` — di situ
hanya boleh ada `.env.example`.

## Apa yang perlu kamu tulis ke AI-nya

Cukup sependek ini:

```
Repo: https://github.com/USERNAME/prompthub
Baca docs/HANDOFF-AI.md dulu sebelum mengubah apa pun.

Yang mau diperbaiki: [jelaskan masalahnya]
```

`docs/HANDOFF-AI.md` sudah berisi arsitektur, skema database, aturan
keamanan, dan batasan hemat usage — jadi kamu tidak perlu menjelaskan
ulang dari nol setiap kali ganti AI.

---

# Bagian 4 — Langkah lanjutan yang sangat disarankan

Sambungkan repo ini ke Netlify supaya Netlify yang build sendiri. Setelah
itu kamu tidak perlu lagi menerima folder `dist` dari siapa pun — cukup
push ke GitHub, situsmu update sendiri.

Caranya ada di `docs/DEPLOY.md` bagian **Cara A**.

---

# Kalau ada masalah

| Masalah | Solusi |
|---|---|
| Upload lewat browser gagal / "too many files" | Pastikan `node_modules` sudah dihapus. Kalau masih gagal, upload per folder: `prompthub-web` dulu, commit, lalu `prompthub-admin`, dst |
| "Repository already exists" saat publish | Repo dengan nama itu sudah ada. Pakai nama lain atau hapus yang lama di Settings → Danger Zone |
| File `.env` terlanjur ter-upload | Hapus filenya di GitHub, commit, lalu ganti anon key di Supabase Dashboard → Settings → API |
| GitHub Desktop bilang ada konflik | Terjadi kalau file yang sama diubah di web dan di lokal. Klik **Fetch origin** dulu sebelum mulai mengedit |
| Bingung folder mana yang dipakai | Setelah clone lewat GitHub Desktop, yang dipakai adalah folder hasil clone. Folder lama simpan saja sebagai cadangan, jangan diedit lagi |
