# Supabase Project Notes — PromptHub

## Tabel Database

| Tabel | Fungsi |
|---|---|
| `profiles` | Profil user, role (architect/admin/member), is_active |
| `categories` | Kategori project/tool, slug, icon, sort_order, is_active |
| `projects` | Konten utama — prompt & tools, video, thumbnail |
| `articles` | Info AI & Tips (category: info-ai / tips) |
| `hero_slides` | Carousel banner di homepage |
| `feedback_requests` | Request/masukan/laporan bug dari user |
| `bookmarks` | Favorit user |
| `analytics` | Tracking copy/generate/view |
| `site_settings` | Konfigurasi global (WA number, toggle feedback/popup) |
| `admin_permissions` | Permission granular per admin |
| `popup_banners` | Popup/banner harian |

## Storage Bucket

Bucket: `media` (public untuk folder tertentu)

| Folder | Akses | Upload |
|---|---|---|
| `thumbnails/` | Public read | Architect / admin w/ permission |
| `articles/` | Public read | Architect / admin w/ permission |
| `slides/` | Public read | Architect / admin w/ permission |
| `tutorials/` | Public read | Architect / admin w/ permission |
| `popup-banners/` | Public read | Architect / admin w/ permission |
| `requests/{user_id}/` | **Private** | Member: hanya own folder |

## Role System

```
architect = admin utama / pemilik sistem / akses penuh
admin     = admin tambahan dengan permission terbatas
member    = user biasa
```

## Edge Functions

| Function | Fungsi |
|---|---|
| `admin-create-user` | Buat user baru (verifikasi role/permission caller) |
| `admin-reset-password` | Reset password user |
| `submit-feedback` | Submit request/laporan (validasi limit, toggle, file) |

## RLS Helper Functions

- `is_architect()` — cek apakah user role = architect
- `has_admin_permission(perm)` — cek permission spesifik (whitelist)
