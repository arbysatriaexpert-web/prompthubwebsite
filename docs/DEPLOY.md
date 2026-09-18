# Deploy

Ada dua cara. Pilih salah satu — jangan dicampur untuk site yang sama.

---

## Cara A — Netlify build sendiri dari GitHub (disarankan)

Sekali disetel, setiap kali kamu push ke GitHub, Netlify otomatis build dan
publish. Tidak perlu drag-drop lagi, dan tidak perlu punya Node di komputer.

Lakukan sekali per site.

### Site web pengunjung

1. Netlify → buka site **userwebsiteprompthub**
2. **Site configuration** → **Build & deploy** → **Link repository**
3. Pilih GitHub → izinkan akses → pilih repo `prompthub`
4. Isi:
   - **Base directory**: `prompthub-web`
   - **Build command**: `npm run build`
   - **Publish directory**: `prompthub-web/dist`
5. **Environment variables** → tambahkan dua ini:
   - `VITE_SUPABASE_URL` → isi dari Supabase Dashboard → Settings → API
   - `VITE_SUPABASE_ANON_KEY` → anon/public key dari halaman yang sama
6. **Deploy site**

### Site panel admin

Sama persis, tapi:

- Site: **paneladminuserweb**
- **Base directory**: `prompthub-admin`
- **Publish directory**: `prompthub-admin/dist`
- Environment variable-nya sama dua itu

### Catatan

`.env` tidak ikut ter-push ke GitHub, jadi environment variable di Netlify
itu wajib diisi. Kalau kosong, aplikasinya akan tampil tapi tidak bisa
menghubungi database.

Setelah cara A aktif, folder `deploy/` di repo tidak dipakai lagi.

---

## Cara B — Drag & drop manual

Dipakai kalau belum sempat menyambungkan repo ke Netlify.

| Netlify site | Folder yang di-drag |
|---|---|
| userwebsiteprompthub | `deploy/web-dist` |
| paneladminuserweb | `deploy/admin-dist` |

Drag **foldernya**, bukan isinya, bukan versi zip.
Setelah publish, buka dengan **Ctrl + Shift + R**.

Folder `deploy/` berisi hasil build, bukan source. Jangan diedit langsung —
kalau ada perubahan, ubah source lalu build ulang.

---

## Database

Patch SQL harus dijalankan **sebelum** deploy frontend yang membutuhkannya.

Supabase Dashboard → SQL Editor → New query → tempel isi file → Run.

Jalankan berurutan dari nomor terkecil, lompati yang sudah pernah dijalankan:

```
supabase/migrations/01_v5_up.sql
supabase/migrations/02_patch_v5.1.sql
supabase/migrations/03_patch_v5.2.sql
supabase/migrations/04_patch_v5.3.sql
supabase/migrations/05_patch_v5.4.sql
```

Semuanya idempotent — aman kalau tidak sengaja dijalankan dua kali.

---

## Edge Functions

Butuh Supabase CLI, dan hanya perlu dijalankan kalau isi
`supabase/functions/` berubah.

```bash
supabase functions deploy admin-create-user
supabase functions deploy admin-delete-user
supabase functions deploy admin-reset-password
supabase functions deploy submit-feedback
```

---

## Pengaturan manual di Supabase Dashboard

Tidak ikut tersimpan di repo, jadi kalau project di-setup ulang harus
dikerjakan tangan:

**Storage → bucket `media` → Edit bucket**
- Public bucket: aktif
- Restrict file size: aktif, **5 MB**
- Restrict MIME types: `image/jpeg, image/png, image/webp, image/gif, video/mp4, video/webm`

**Authentication → Providers**
- Email aktif

**Settings → API**
- Ambil URL dan anon key untuk environment variable Netlify
