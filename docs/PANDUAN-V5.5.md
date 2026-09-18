# PromptHub v5.5 — Panduan Pasang & Push

Semua file di paket ini adalah **pengganti utuh**, bukan potongan tambal.
Salin menimpa file lama pada path yang sama, lalu push. Tidak ada langkah
"cari baris ini lalu sisipkan itu".

---

## 1. Daftar file

### `prompthub-web/`

| Path | Status |
|---|---|
| `netlify.toml` | ganti |
| `vite.config.js` | ganti |
| `src/App.jsx` | ganti |
| `src/main.jsx` | ganti |
| `src/lib/mediaCache.js` | **baru** |
| `src/lib/dataCache.js` | **baru** |
| `src/lib/lazyWithRetry.js` | **baru** |
| `src/components/CachedMedia.jsx` | **baru** |
| `src/components/Pagination.jsx` | **baru** |
| `src/components/RouteFallback.jsx` | **baru** |
| `src/components/ArticleCard.jsx` | ganti |
| `src/components/PopupBanner.jsx` | ganti |
| `src/contexts/SettingsContext.jsx` | ganti |
| `src/pages/HomePage.jsx` | ganti |
| `src/pages/ToolsPage.jsx` | ganti |
| `src/pages/ToolsPage.css` | ganti |
| `src/pages/InfoPage.jsx` | ganti |
| `src/pages/TipsPage.jsx` | ganti |
| `src/pages/AkunPage.jsx` | ganti |
| `src/pages/ToolDetailPage/ToolDetailPage.jsx` | ganti |

### `prompthub-admin/`

| Path | Status |
|---|---|
| `netlify.toml` | ganti |
| `vite.config.js` | ganti |
| `src/App.jsx` | ganti |
| `src/main.jsx` | ganti |
| `src/lib/mediaCache.js` | **baru** |
| `src/lib/dataCache.js` | **baru** |
| `src/lib/lazyWithRetry.js` | **baru** |
| `src/lib/uploadLimits.js` | **baru** |
| `src/lib/imageCompress.js` | **baru** |
| `src/components/MediaUploadField.jsx` | **baru** |
| `src/components/MediaUploadField.css` | **baru** |
| `src/components/CacheStatusPanel.jsx` | **baru** |
| `src/components/RouteFallback.jsx` | **baru** |
| `src/contexts/SettingsContext.jsx` | ganti |
| `src/pages/admin/AdminProjects.jsx` | ganti |
| `src/pages/admin/AdminArticles.jsx` | ganti |
| `src/pages/admin/AdminSlides.jsx` | ganti |
| `src/pages/admin/AdminCategories.jsx` | ganti |
| `src/pages/admin/AdminPopupBanners.jsx` | ganti |
| `src/pages/admin/AdminSettings.jsx` | ganti |

### `supabase/`

| Path | Status |
|---|---|
| `migrations/06_patch_v5.5.sql` | **baru** — jalankan di SQL Editor |
| `functions/submit-feedback/index.ts` | ganti — perlu deploy ulang |

Tidak ada dependensi npm baru. `package.json` tidak berubah.

---

## 2. Urutan pengerjaan

Ikuti urutan ini. SQL didahulukan supaya index-nya sudah ada saat kode baru
mulai memakai `.range()`.

### Langkah 1 — Jalankan SQL

Supabase Dashboard → SQL Editor → New query → tempel isi
`06_patch_v5.5.sql` → Run.

Bagian F di file itu **tidak** ikut jalan (semuanya komentar). Isinya catatan
keamanan soal bucket public yang perlu kamu putuskan sendiri — baca nanti,
tidak mendesak.

### Langkah 2 — Salin file ke repo lokal

Ekstrak paket ini, lalu timpa folder repo kamu. Struktur paket sudah sama
persis dengan struktur repo, jadi bisa disalin satu folder sekaligus.

Di Windows Explorer: pilih `prompthub-web`, `prompthub-admin`, `supabase`,
`docs` dari paket → Copy → tempel di folder repo → pilih **Replace the files
in the destination**.

### Langkah 3 — Uji di lokal dulu

Jangan langsung push. Sekali jalan di lokal menghemat satu siklus deploy yang
gagal.

```bash
cd prompthub-web
npm install
npm run build        # harus selesai tanpa error
npm run dev          # buka http://localhost:5173
```

Lalu ulangi untuk `prompthub-admin`.

Kalau `npm run build` gagal, hampir pasti ada file yang belum tersalin.
Pesan errornya menyebut path yang hilang.

### Langkah 4 — Push

```bash
cd /path/ke/prompthubwebsite

git status                    # pastikan yang berubah memang file di atas
git add -A
git commit -m "v5.5: code splitting, pagination Tools, cache media persisten, perbaikan preview upload, batas lampiran 2MB"
git push origin main
```

Netlify akan otomatis membangun ulang kedua site. Tunggu sampai status
**Published** di dashboard Netlify sebelum menguji.

### Langkah 5 — Deploy Edge Function

Ini **tidak** ikut terbawa push GitHub. Harus dijalankan terpisah:

```bash
supabase functions deploy submit-feedback
```

Kalau belum punya Supabase CLI, bisa juga lewat Dashboard → Edge Functions →
`submit-feedback` → tempel isi file baru → Deploy.

**Kalau langkah ini dilewat**, user masih bisa mengirim video 2–5 MB dan
form web akan menolaknya duluan — tidak rusak, hanya batasnya tidak
diberlakukan di server. Tapi sebaiknya tetap dideploy supaya konsisten.

---

## 3. Verifikasi setelah deploy

### Poin 4 — cache-control JS/CSS sudah jalan?

Buka situs → F12 → tab **Network** → muat ulang → klik salah satu file
di `/assets/`. Di panel **Headers**, cari `Cache-Control`. Harus berbunyi:

```
cache-control: public, max-age=31536000, immutable
```

Lalu muat ulang sekali lagi (Ctrl+R biasa, **bukan** Ctrl+Shift+R). Kolom
Size untuk file `/assets/` harus berubah jadi `(disk cache)` atau
`(memory cache)`.

`index.html` sebaliknya harus tetap `max-age=0, must-revalidate`. Itu
disengaja — file inilah yang memuat daftar nama chunk terbaru. Kalau ia ikut
di-cache lama, user akan terus membuka versi lama meski sudah deploy baru.

**Cek halaman Usage Netlify:** Netlify Dashboard → klik nama tim di pojok
kiri atas → **Usage**. Di sana ada grafik *Bandwidth* dan *Build minutes*
untuk seluruh tim. Kalau ingin per-site, masuk ke site → **Usage** di menu
samping. Catat angka bandwidth hari ini, bandingkan seminggu lagi.

### Poin 3 — cache video benar-benar tersimpan di device?

Tiga cara, dari yang paling gampang:

**a. Lewat panel admin.** Masuk panel → Pengaturan → gulir ke bawah, ada
kotak **💾 Cache di Device Ini**. Menampilkan status penyimpanan permanen,
jumlah file, ukuran total, dan — klik "Lihat daftar file" — tanggal
kedaluwarsa per file. Ini jawaban langsung untuk pertanyaan "berapa lama".

**b. Lewat DevTools.** F12 → tab **Application** → Storage → IndexedDB →
`prompthub-cache` → `media`. Setiap baris berisi `blob`, `size`, `storedAt`,
`ttl`. `ttl` bernilai `31536000000` milidetik = 365 hari.

Di halaman **Application → Storage** yang sama, ada baris
*"Storage persisted?"*. Kalau `true`, browser tidak akan membuang cache situs
ini walaupun disk menipis.

**c. Uji nyata.** Buka halaman Tools, tunggu thumbnail video muncul. Muat
ulang halaman sambil membuka tab Network dan filter **Media**. Setelah muat
kedua, tidak boleh ada request ke domain `supabase.co` untuk file video itu.

### Poin 1 — code splitting jalan?

F12 → Network → filter **JS** → buka Home. Yang terunduh hanya
`index-*.js`, `vendor-react-*.js`, `vendor-router-*.js`,
`vendor-supabase-*.js`, dan chunk `HomePage-*.js`. Klik menu Tools: muncul
request baru untuk chunk `ToolsPage-*.js`. Itu tandanya berhasil.

### Poin 2 — pagination

Buka `/tools`. Di bawah grid ada pager dengan keterangan "Menampilkan 1–12
dari N". Klik halaman 2, URL berubah jadi `/tools?page=2`. Pilih kategori,
pager ikut menyesuaikan dan halaman kembali ke 1.

### Poin 5 — preview upload

Panel → Kelola Project → Tambah Project → pilih file di kolom Thumbnail.
Preview harus muncul **seketika**, sebelum tulisan "Mengunggah…" hilang.
Untuk gambar akan muncul keterangan hijau semacam
"Dikecilkan 3,2 MB → 180 KB (WebP)".

Kalau upload gagal, sekarang selalu ada toast merah berisi pesan asli dari
Supabase. Sebelumnya di halaman Slides, Popup Banner, dan Kategori kegagalan
lewat tanpa pesan apa pun.

### Poin 6 — batas 2 MB

Web → Akun → Kirim Masukan → coba lampirkan video di atas 2 MB. Muncul pesan
yang menyebut ukuran filemu, misalnya "File kamu 4,3MB — coba dipotong atau
dikecilkan dulu."

---

## 4. Keputusan yang saya ambil sendiri

Kamu minta jangan ada pertanyaan, jadi beberapa percabangan saya putuskan.
Kalau ada yang tidak cocok, tinggal diubah — saya tulis lokasinya.

**Ukuran halaman Tools: 12 kartu.** Cukup untuk mengisi layar HP tanpa
scroll panjang. Ubah di `ToolsPage.jsx`, konstanta `PAGE_SIZE`.

**Umur cache media: 1 tahun.** Kamu minta "selama mungkin". Satu tahun
adalah batas praktis — di atas itu tidak ada bedanya karena browser sendiri
punya batas. Ubah di `mediaCache.js`, `DEFAULT_MEDIA_TTL`.

**Jatah cache: 300 MB (web) / 150 MB (panel).** Kalau terlampaui, file yang
paling lama tidak dipakai dibuang lebih dulu. Angka ini jauh di bawah kuota
tipikal browser, jadi aman. Ubah di `DEFAULT_BUDGET_BYTES` dan `main.jsx`.

**Thumbnail video tetap autoplay, tapi hanya setelah kartunya masuk layar.**
Saya sempat mempertimbangkan mengganti jadi gambar diam dengan tombol play —
lebih hemat lagi, tapi mengubah tampilan situsmu cukup drastis. Pilihan
sekarang mempertahankan tampilan, sambil tetap memotong sebagian besar
egress karena kartu yang belum discroll tidak mengunduh apa pun dan
kunjungan kedua nol byte. Kalau mau lebih agresif: di `CachedMedia.jsx`,
fungsi `CardMedia`, ganti `mode="inview"` jadi `mode="click"`.

**Video di halaman detail sekarang klik-dulu-baru-unduh.** Ini saya ubah
tanpa ragu: video tutorial bisa puluhan MB dan sebelumnya `preload="metadata"`
tetap menarik data untuk setiap pengunjung yang membuka halaman, termasuk
yang tidak berniat menonton.

**Daftar data di panel admin TIDAK saya cache.** Sengaja. Panel adalah
tempat kamu mengubah data; kalau daftarnya di-cache, kamu akan menyimpan
sesuatu lalu melihat data lama dan mengira gagal tersimpan. Itu persis jenis
bug yang sudah beberapa kali muncul di project ini. Yang di-cache di panel
hanya **media** (gambar dan video, yang tidak pernah berubah karena nama
filenya unik) dan `site_settings`, yang sengaja dibuang cache-nya tepat
setelah kamu menekan Simpan.

**Kompresi gambar: maksimal 1600 px, WebP kualitas 0,82.** Untuk ikon
kategori dan logo saya turunkan ke 512 px karena memang ditampilkan kecil.
Kalau hasil "kompresi" ternyata lebih besar dari aslinya — sering terjadi
pada PNG ikon sederhana — file asli yang dipakai.

**Batas upload panel: gambar 5 MB, video 8 MB.** Di `uploadLimits.js`.
Ditambah batas 10 MB di level bucket lewat SQL sebagai pertahanan terakhir.

---

## 5. Kalau ada yang rusak setelah deploy

**Halaman putih total.** Kemungkinan besar chunk lama masih dipegang tab
lamamu. `lazyWithRetry` menangani ini dengan memuat ulang sekali otomatis.
Kalau masih putih, buka DevTools → Console dan lihat pesannya; biasanya
menyebut file yang gagal di-import.

**Rollback cepat.** Netlify menyimpan setiap deploy. Site → Deploys → pilih
deploy sebelumnya → **Publish deploy**. Situs kembali ke versi lama dalam
hitungan detik, tanpa perlu menyentuh Git.

**Rollback di Git.**

```bash
git revert HEAD
git push origin main
```

**Cache di device user terlanjur salah.** Panel → Pengaturan → tombol
"Hapus cache media". Untuk user biasa: browser mereka → Clear site data.
Kalau perlu memaksa semua orang membuang cache data (bukan media), naikkan
`CACHE_SCHEMA_VERSION` di `dataCache.js` — semua entri lama otomatis
dianggap tidak valid.

**SQL Langkah 1 gagal.** Kalau pesannya menyebut fungsi `is_architect()`
atau `is_admin_or_above()` tidak ada, berarti migrasi `01_v5_up.sql` belum
pernah dijalankan di database itu. Jalankan dulu yang itu.

---

## 6. Yang masih terbuka

Saya tidak menyentuh ini, tapi perlu kamu tahu.

**`AdminProjects` menarik `prompt_data` untuk semua baris.** Query daftarnya
memakai `select('*, categories(name, icon)')`, jadi seluruh isi prompt ikut
terkirim setiap kali kamu membuka halaman Kelola Project. Untuk memperbaiki
tanpa merusak tampilan, kolom cuplikan prompt di daftar perlu diganti jadi
kolom terpisah di database (atau dihapus dari tampilan). Karena ini halaman
admin yang cuma kamu buka, dampaknya jauh lebih kecil daripada halaman
publik — tapi kalau prompt-mu panjang-panjang, ini pos berikutnya yang layak
dibereskan.

**Lampiran feedback kemungkinan bisa diakses publik.** Penjelasan lengkap
ada di bagian F `06_patch_v5.5.sql`. Perlu keputusanmu.

**Video tidak dikompres saat upload.** Hanya gambar. Mengompres video di
browser butuh library berat (ffmpeg.wasm, belasan MB) yang justru merugikan.
Untuk sekarang batas 8 MB yang menahan.

**Edge Function `admin-delete-user` masih mengizinkan role `admin` menghapus
user mana pun.** Sudah tercatat di `HANDOFF-AI.md` sejak sebelumnya, belum
saya sentuh karena di luar cakupan enam poin.
