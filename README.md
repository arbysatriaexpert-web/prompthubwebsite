# PromptHub

Katalog prompt dan tool AI. Dua aplikasi terpisah yang berbagi satu database Supabase.

| Aplikasi | Isi | Netlify |
|---|---|---|
| `prompthub-web/` | Website untuk pengunjung | userwebsiteprompthub |
| `prompthub-admin/` | Panel pengelola konten | paneladminuserweb |

Versi berjalan: **v5.4**

---

## Struktur

```
prompthub-web/          Frontend pengunjung (React + Vite)
prompthub-admin/        Panel admin (React + Vite)
supabase/
  migrations/           Patch SQL, jalankan berurutan dari nomor terkecil
  functions/            Edge Function (Deno)
deploy/
  web-dist/             Hasil build siap drag ke Netlify
  admin-dist/
docs/
  HANDOFF-AI.md         Baca ini dulu kalau kamu AI yang baru masuk
  CHANGELOG.md          Riwayat perubahan per versi
  DEPLOY.md             Cara deploy
  SPEC-V5.md            Spesifikasi produk
  SUPABASE-NOTES.md     Catatan skema & policy
```

---

## Menjalankan di lokal

```bash
cd prompthub-web        # atau prompthub-admin
cp .env.example .env    # isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

`.env` tidak ikut di-commit. Nilainya diambil dari Supabase Dashboard →
Settings → API. Yang dipakai hanya **anon key**; service role key tidak
boleh masuk ke folder frontend mana pun.

## Build

```bash
npm run build           # hasilnya di dist/
```

---

## Database

Patch SQL di `supabase/migrations/` bersifat menumpuk dan idempotent —
aman dijalankan berulang, tapi urutannya tidak boleh dilompati.

Jalankan lewat Supabase Dashboard → SQL Editor → New query → tempel → Run.

`00_v5_down_rollback.sql` adalah pembatal, jangan dijalankan kecuali
memang mau mengosongkan struktur v5.

---

## Catatan untuk kontributor (termasuk AI)

- Jangan pernah menaruh service role key, password database, atau JWT secret
  di dalam folder `prompthub-web/` dan `prompthub-admin/`. Keduanya di-bundle
  ke browser, jadi apa pun di sana bisa dibaca pengunjung.
- Setiap query baru ke tabel besar (`projects`, `articles`) sebutkan kolomnya,
  jangan `select('*')`. Free plan Supabase dibatasi 5 GB egress per bulan dan
  `prompt_data` berukuran besar.
- Semua tabel memakai Row Level Security. Kalau ada fitur yang "tidak jalan
  tanpa pesan error", kemungkinan besar tertahan RLS, bukan bug UI.
- Baca `docs/HANDOFF-AI.md` sebelum mengubah apa pun.
