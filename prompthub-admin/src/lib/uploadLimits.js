/**
 * uploadLimits.js — PromptHub v5.5
 *
 * Satu tempat untuk semua aturan ukuran & format upload. Sebelumnya angka
 * batas tersebar di beberapa file dan sebagian tidak ada sama sekali, jadi
 * admin bisa mengunggah video 40 MB ke thumbnail tanpa peringatan apa pun —
 * dan file sebesar itu akan diunduh ulang oleh setiap pengunjung.
 */

export const MB = 1024 * 1024;

/** Lampiran dari user di web (harus sama dengan Edge Function submit-feedback). */
export const USER_ATTACHMENT_MAX_BYTES = 2 * MB;

/** Gambar yang diunggah admin — setelah dikompres biasanya jauh di bawah ini. */
export const ADMIN_IMAGE_MAX_BYTES = 5 * MB;

/** Video yang diunggah admin (thumbnail bergerak / slide). */
export const ADMIN_VIDEO_MAX_BYTES = 8 * MB;

/**
 * Umur cache yang diminta ke Supabase Storage, dalam detik.
 *
 * Default Supabase hanya 3600 (1 jam). Artinya browser pengunjung menanyakan
 * ulang setiap file media setiap jam — padahal nama filenya sudah unik
 * (berisi timestamp) dan isinya tidak pernah berubah. Dengan 1 tahun,
 * pengunjung yang kembali tidak mengunduh apa pun lagi.
 */
export const STORAGE_CACHE_CONTROL = '31536000';

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
export const VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

export function formatBytes(bytes = 0) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;
}

export function isImageFile(file) {
  return !!file && file.type.startsWith('image/');
}

export function isVideoFile(file) {
  return !!file && file.type.startsWith('video/');
}

/**
 * @param {File} file
 * @param {{ kind?: 'image'|'video'|'both' }} opts
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateUpload(file, { kind = 'both' } = {}) {
  if (!file) return { ok: false, error: 'Tidak ada file yang dipilih.' };

  const image = isImageFile(file);
  const video = isVideoFile(file);

  if (!image && !video) {
    return { ok: false, error: 'Format tidak didukung. Pilih gambar atau video.' };
  }
  if (kind === 'image' && !image) {
    return { ok: false, error: 'Kolom ini hanya menerima gambar.' };
  }
  if (kind === 'video' && !video) {
    return { ok: false, error: 'Kolom ini hanya menerima video.' };
  }

  const max = image ? ADMIN_IMAGE_MAX_BYTES : ADMIN_VIDEO_MAX_BYTES;
  if (file.size > max) {
    return {
      ok: false,
      error:
        `Ukuran ${image ? 'gambar' : 'video'} maksimal ${formatBytes(max)}. ` +
        `File ini ${formatBytes(file.size)}. Kecilkan dulu sebelum diunggah — ` +
        `file besar akan diunduh ulang oleh setiap pengunjung dan cepat menghabiskan kuota Supabase.`,
    };
  }

  return { ok: true };
}

/** Nama file aman: huruf, angka, titik, strip. */
export function safeFileName(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(-60);
}
