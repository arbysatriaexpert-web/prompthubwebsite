/**
 * imageCompress.js — PromptHub v5.5
 *
 * Mengecilkan dan mengubah gambar ke WebP di browser SEBELUM dikirim ke
 * Supabase Storage. Tanpa dependensi tambahan, murni canvas.
 *
 * Kenapa ini penting:
 *  - docs/HANDOFF-AI.md sudah menyatakan "upload gambar dari panel sudah
 *    dikecilkan dan dikonversi ke WebP", tetapi kodenya tidak pernah ada.
 *    Yang terjadi selama ini: foto 4 MB dari HP diunggah mentah-mentah,
 *    lalu diunduh utuh oleh setiap pengunjung yang membuka halaman itu.
 *  - Thumbnail hanya ditampilkan selebar beberapa ratus piksel. Menyimpan
 *    versi 4000 px sama saja membuang kuota storage dan egress.
 *  - Supabase Image Transformation berbayar, jadi pengecilan harus
 *    dikerjakan di sisi browser.
 *
 * File yang tidak diproses: SVG dan GIF (animasi akan hilang kalau digambar
 * ulang ke canvas).
 */

const SKIP_TYPES = ['image/svg+xml', 'image/gif'];

/** Di bawah ukuran ini dan sudah cukup kecil dimensinya, biarkan apa adanya. */
const ALREADY_SMALL_BYTES = 180 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak bisa dibaca')); };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function supportsWebp() {
  try {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    return c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

/**
 * @param {File} file
 * @param {{maxWidth?:number, maxHeight?:number, quality?:number}} opts
 * @returns {Promise<{file: File, changed: boolean, before: number, after: number}>}
 *
 * Tidak pernah melempar error: kalau apa pun gagal, file asli dikembalikan
 * apa adanya supaya upload tetap bisa jalan.
 */
export async function compressImage(file, opts = {}) {
  const { maxWidth = 1600, maxHeight = 1600, quality = 0.82 } = opts;
  const before = file.size;
  const unchanged = { file, changed: false, before, after: before };

  try {
    if (!file || !file.type.startsWith('image/')) return unchanged;
    if (SKIP_TYPES.includes(file.type)) return unchanged;
    if (typeof document === 'undefined') return unchanged;

    const img = await loadImage(file);
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) return unchanged;

    const scale = Math.min(1, maxWidth / w, maxHeight / h);
    if (scale === 1 && before <= ALREADY_SMALL_BYTES) return unchanged;

    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return unchanged;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const type = supportsWebp() ? 'image/webp' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, type, quality);
    if (!blob) return unchanged;

    // Kalau hasil "kompresi" malah lebih besar (sering terjadi pada PNG
    // ikon kecil), pakai file asli saja.
    if (blob.size >= before) return unchanged;

    const ext = type === 'image/webp' ? 'webp' : 'jpg';
    const base = (file.name || 'image').replace(/\.[^.]+$/, '');
    const out = new File([blob], `${base}.${ext}`, { type, lastModified: Date.now() });

    return { file: out, changed: true, before, after: out.size };
  } catch {
    return unchanged;
  }
}

export default compressImage;
