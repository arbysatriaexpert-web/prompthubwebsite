# Storage Policy Notes — Bucket `media`

## Public Read Folders
- `thumbnails/` — thumbnail project/tool
- `articles/` — gambar artikel
- `slides/` — gambar hero slide
- `tutorials/` — video tutorial
- `popup-banners/` — gambar popup banner

## Private Folders
- `requests/{user_id}/` — attachment feedback/request user
  - Member hanya bisa upload ke `requests/{own_uid}/`
  - Admin/architect akses via signed URL
  - Public/anon tidak bisa akses

## Upload Rules
- Architect: upload/update/delete semua folder
- Admin: upload/update/delete sesuai permission menu terkait
- Member: HANYA upload ke `requests/{own_uid}/`
- Member TIDAK boleh overwrite/delete file user lain

## Upload Size Limits
- Foto: max 2MB (image/jpeg, image/png, image/webp)
- Video: max 5MB (video/mp4)
- Validasi di: client + Edge Function + storage policy (fileSizeLimit)
