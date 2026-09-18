import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/imageCompress'
import { putMediaBlob } from '../lib/mediaCache'
import {
  validateUpload,
  formatBytes,
  isImageFile,
  isVideoFile,
  safeFileName,
  STORAGE_CACHE_CONTROL,
} from '../lib/uploadLimits'
import './MediaUploadField.css'

/**
 * MediaUploadField — PromptHub v5.5
 *
 * ────────────────────────────────────────────────────────────────
 * BUG YANG DIPERBAIKI
 * ────────────────────────────────────────────────────────────────
 * Semua kolom upload di panel (Thumbnail, Artikel, Logo, Ikon Kategori,
 * Slide, Banner) memakai pola yang sama:
 *
 *     upload ke Supabase → getPublicUrl() → setForm({ url })
 *     preview dirender HANYA kalau form.url sudah terisi
 *
 * Akibatnya ada tiga cara preview bisa tidak muncul, dan semuanya pernah
 * terjadi:
 *
 *   1. Selama upload berlangsung tidak ada apa pun yang ditampilkan. Untuk
 *      file beberapa MB di koneksi seluler, ini terasa seperti "tidak
 *      berfungsi" — padahal hanya sedang menunggu.
 *   2. Kalau upload GAGAL, sebagian halaman (Slides, Popup Banner,
 *      Kategori) hanya menulis `if (!error) { ... }` tanpa cabang else.
 *      Gagal karena RLS atau ukuran file lewat tanpa pesan apa pun.
 *   3. Kalau bucket `media` di Supabase tidak disetel Public, URL dari
 *      getPublicUrl() mengembalikan 400 dan <img> gagal memuat — file
 *      sebenarnya tersimpan, tapi layar tetap kosong.
 *
 * Komponen ini menutup ketiganya:
 *
 *   • Preview muncul SEKETIKA dari file lokal (object URL), sebelum upload
 *     dimulai. Tidak bergantung pada jaringan sama sekali.
 *   • Setiap error dari Supabase dilaporkan lewat onError (toast).
 *   • Preview lokal tetap dipakai sesudah upload selesai, jadi meski URL
 *     publiknya bermasalah gambarnya tetap terlihat; kalau URL memang
 *     gagal dimuat, muncul peringatan yang menyebut kemungkinan penyebabnya.
 *
 * Bonus hemat egress:
 *   • Gambar dikecilkan & dikonversi ke WebP sebelum dikirim.
 *   • Upload memakai cacheControl 1 tahun (default Supabase cuma 1 jam).
 *   • File yang barusan diunggah langsung didaftarkan ke cache device,
 *     jadi panel tidak mengunduhnya kembali.
 */
export default function MediaUploadField({
  label,
  value = '',
  folder = 'thumbnails',
  prefix = '',
  accept = 'image/*',
  kind = 'image',            // 'image' | 'video' | 'both'
  onUploaded,
  onRemove,
  onError,
  onSuccess,
  disabled = false,
  hint,
  previewHeight = 140,
  compress = true,
  maxWidth = 1600,
  className = '',
}) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [localPreview, setLocalPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [remoteBroken, setRemoteBroken] = useState(false)
  const [note, setNote] = useState('')

  /**
   * Object URL dibuat di dalam effect dan dilepas di cleanup-nya.
   * Ini bentuk yang benar: kalau revoke dipanggil langsung setelah
   * createObjectURL (atau di dalam handler klik), browser bisa membuang
   * URL-nya sebelum sempat menggambar — preview berkedip lalu hilang.
   */
  useEffect(() => {
    if (!file) { setLocalPreview(''); return }
    const url = URL.createObjectURL(file)
    setLocalPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const shownUrl = localPreview || value
  const showAsVideo = file ? isVideoFile(file) : /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(value || '')
  const hasPreview = !!shownUrl

  function report(msg, type = 'error') {
    if (type === 'error' && typeof onError === 'function') onError(msg)
    if (type === 'success' && typeof onSuccess === 'function') onSuccess(msg)
  }

  async function handlePick(e) {
    const input = e.target
    const picked = input.files?.[0]

    // Reset lebih dulu supaya memilih file yang SAMA dua kali tetap memicu
    // onChange. Tanpa ini, hapus lalu pilih file yang sama terasa macet.
    input.value = ''
    if (!picked) return

    setNote('')
    setRemoteBroken(false)

    const check = validateUpload(picked, { kind })
    if (!check.ok) {
      setFile(null)
      report(check.error)
      return
    }

    // 1. Tampilkan dulu. Preview tidak menunggu jaringan.
    let finalFile = picked
    setFile(picked)

    // 2. Kecilkan kalau gambar.
    if (compress && isImageFile(picked)) {
      const result = await compressImage(picked, { maxWidth, maxHeight: maxWidth })
      finalFile = result.file
      if (result.changed) {
        setFile(result.file) // preview memakai versi yang benar-benar diunggah
        setNote(`Dikecilkan ${formatBytes(result.before)} → ${formatBytes(result.after)} (WebP)`)
      }
    }

    // 3. Unggah.
    await upload(finalFile)
  }

  async function upload(target) {
    setUploading(true)
    try {
      const ext = (target.name.split('.').pop() || 'bin').toLowerCase()
      const rand = Math.random().toString(36).slice(2, 8)
      const path = `${folder}/${prefix}${Date.now()}_${rand}.${safeFileName(ext)}`

      const { error } = await supabase.storage
        .from('media')
        .upload(path, target, {
          cacheControl: STORAGE_CACHE_CONTROL,
          contentType: target.type || undefined,
          upsert: false,
        })

      if (error) {
        // Pesan asli Supabase selalu ditampilkan. Gagal diam-diam adalah
        // sumber bug tersering di project ini.
        const hintText = /row-level security|42501/i.test(error.message || '')
          ? ' — sepertinya ditahan RLS. Cek policy media_admin_upload untuk folder ini.'
          : ''
        report(`Gagal upload: ${error.message}${hintText}`)
        setFile(null)
        return
      }

      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
      const publicUrl = urlData?.publicUrl || ''

      // Daftarkan file yang BARU SAJA diunggah ke cache device, memakai URL
      // publiknya sebagai kunci. Panel dan tab lain di device ini tidak perlu
      // mengunduhnya lagi.
      putMediaBlob(publicUrl, target).catch(() => {})

      if (typeof onUploaded === 'function') onUploaded(publicUrl)
      report('File berhasil diunggah.', 'success')
    } catch (err) {
      report(`Gagal upload: ${err.message}`)
      setFile(null)
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    setFile(null)
    setNote('')
    setRemoteBroken(false)
    if (typeof onRemove === 'function') onRemove()
  }

  function handleDrop(e) {
    e.preventDefault()
    if (disabled || uploading) return
    const dropped = e.dataTransfer?.files?.[0]
    if (!dropped) return
    handlePick({ target: { files: [dropped], value: '' } })
  }

  return (
    <div className={`mu-field ${className}`}>
      {label && <label className="field-label">{label}</label>}

      {hasPreview ? (
        <div className="mu-preview" style={{ maxHeight: previewHeight + 40 }}>
          {showAsVideo ? (
            <video
              src={shownUrl}
              controls
              preload="metadata"
              className="mu-media"
              style={{ maxHeight: previewHeight }}
              onError={() => { if (!localPreview) setRemoteBroken(true) }}
            />
          ) : (
            <img
              src={shownUrl}
              alt={label || 'preview'}
              className="mu-media"
              style={{ maxHeight: previewHeight }}
              onError={() => { if (!localPreview) setRemoteBroken(true) }}
            />
          )}

          <button
            type="button"
            className="mu-remove"
            onClick={handleRemove}
            disabled={uploading}
            aria-label="Hapus media"
          >
            ×
          </button>

          {uploading && <div className="mu-overlay">Mengunggah…</div>}
        </div>
      ) : (
        <label
          className={`mu-drop ${disabled ? 'is-disabled' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handlePick}
            disabled={disabled || uploading}
          />
          <span className="mu-drop-icon">📤</span>
          <span className="mu-drop-text">
            {uploading ? 'Mengunggah…' : 'Klik atau seret file ke sini'}
          </span>
        </label>
      )}

      {note && <p className="mu-note mu-note--ok">{note}</p>}

      {remoteBroken && (
        <p className="mu-note mu-note--warn">
          File tersimpan, tapi URL-nya tidak bisa ditampilkan. Biasanya karena
          bucket <code>media</code> di Supabase belum disetel <strong>Public</strong>
          (Dashboard → Storage → media → Settings), atau path folder tidak termasuk
          folder publik.
        </p>
      )}

      {hint && <p className="mu-hint">{hint}</p>}

      {hasPreview && !uploading && (
        <p className="mu-hint">
          Untuk mengganti, hapus dulu dengan tombol × lalu pilih file baru.
        </p>
      )}
    </div>
  )
}
