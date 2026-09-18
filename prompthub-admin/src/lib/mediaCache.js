/**
 * mediaCache.js — PromptHub v5.5
 *
 * Menyimpan file media (video / gambar) dari Supabase Storage sebagai Blob
 * di IndexedDB milik device. Setelah file diunduh SEKALI, kunjungan
 * berikutnya tidak menyentuh Supabase sama sekali → egress hemat.
 *
 * Kenapa IndexedDB, bukan cache HTTP browser:
 *  - Cache HTTP bisa dibuang browser kapan saja tanpa pemberitahuan dan
 *    tidak bisa diperiksa isinya.
 *  - Signed URL punya query ?token=... yang berubah tiap kali dibuat,
 *    jadi cache HTTP selalu meleset. Di sini token itu dibuang dari kunci.
 *  - IndexedDB + navigator.storage.persist() bertahan sampai user sendiri
 *    yang menghapus lewat "Clear site data".
 *
 * Cara verifikasi manual (Chrome):
 *   F12 → Application → Storage → IndexedDB → prompthub-cache → media
 *   F12 → Application → Storage → "Storage persisted?" idealnya true
 *   F12 → Network → muat ulang halaman: file media tidak muncul lagi
 */

const DB_NAME = 'prompthub-cache';
const DB_VERSION = 1;
export const STORE_MEDIA = 'media';
export const STORE_DATA = 'data';

export const DAY = 86400000;

/** Umur simpan default: 1 tahun — "selama mungkin" yang masih aman. */
export const DEFAULT_MEDIA_TTL = 365 * DAY;

/** Jatah ruang media. Lewat dari ini, yang paling lama tak dipakai dibuang. */
export const DEFAULT_BUDGET_BYTES = 300 * 1024 * 1024; // 300 MB

let dbPromise = null;

export function idbAvailable() {
  return typeof indexedDB !== 'undefined';
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!idbAvailable()) {
      reject(new Error('IndexedDB tidak tersedia di browser ini'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        const s = db.createObjectStore(STORE_MEDIA, { keyPath: 'key' });
        s.createIndex('lastUsed', 'lastUsed');
      }
      if (!db.objectStoreNames.contains(STORE_DATA)) {
        db.createObjectStore(STORE_DATA, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function store(name, mode) {
  return openDB().then((db) => db.transaction(name, mode).objectStore(name));
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet(name, key) {
  const s = await store(name, 'readonly');
  return wrap(s.get(key));
}
export async function idbPut(name, value) {
  const s = await store(name, 'readwrite');
  return wrap(s.put(value));
}
export async function idbDelete(name, key) {
  const s = await store(name, 'readwrite');
  return wrap(s.delete(key));
}
export async function idbAll(name) {
  const s = await store(name, 'readonly');
  return wrap(s.getAll());
}
export async function idbClear(name) {
  const s = await store(name, 'readwrite');
  return wrap(s.clear());
}

/* ------------------------------------------------------------------ */
/* Kunci cache                                                         */
/* ------------------------------------------------------------------ */

/**
 * Hanya parameter yang benar-benar mengubah isi file yang dipertahankan.
 * Selain itu — termasuk `token`, `t`, `v` — dibuang supaya signed URL
 * yang di-generate ulang tetap kena cache yang sama.
 */
const CONTENT_PARAMS = ['width', 'height', 'quality', 'resize', 'format'];

export function cacheKeyFor(url) {
  try {
    const base = typeof location !== 'undefined' ? location.href : 'https://x/';
    const u = new URL(url, base);
    const kept = [];
    for (const p of CONTENT_PARAMS) {
      const v = u.searchParams.get(p);
      if (v) kept.push(`${p}=${v}`);
    }
    return u.origin + u.pathname + (kept.length ? '?' + kept.sort().join('&') : '');
  } catch {
    return String(url);
  }
}

/* ------------------------------------------------------------------ */
/* Object URL hidup selama sesi                                        */
/* ------------------------------------------------------------------ */

/**
 * Object URL sengaja TIDAK di-revoke selama halaman hidup. Revoke terlalu
 * dini adalah penyebab paling umum gambar/video mendadak blank. Browser
 * otomatis melepasnya saat tab ditutup.
 */
const liveUrls = new Map(); // cacheKey -> objectURL

function registerObjectUrl(key, blob) {
  const existing = liveUrls.get(key);
  if (existing) return existing;
  const objUrl = URL.createObjectURL(blob);
  liveUrls.set(key, objUrl);
  return objUrl;
}

function releaseAllObjectUrls() {
  for (const url of liveUrls.values()) {
    try { URL.revokeObjectURL(url); } catch { /* abaikan */ }
  }
  liveUrls.clear();
}

/* ------------------------------------------------------------------ */
/* Baca / tulis media                                                  */
/* ------------------------------------------------------------------ */

function touch(key) {
  idbGet(STORE_MEDIA, key)
    .then((rec) => {
      if (!rec) return;
      rec.lastUsed = Date.now();
      rec.hits = (rec.hits || 0) + 1;
      return idbPut(STORE_MEDIA, rec);
    })
    .catch(() => { /* abaikan */ });
}

export async function hasCachedMedia(url) {
  if (!url) return false;
  const key = cacheKeyFor(url);
  if (liveUrls.has(key)) return true;
  try {
    const rec = await idbGet(STORE_MEDIA, key);
    if (!rec || !rec.blob) return false;
    return Date.now() - rec.storedAt < (rec.ttl || DEFAULT_MEDIA_TTL);
  } catch {
    return false;
  }
}

/**
 * Daftarkan Blob yang SUDAH ada di memori (misal file yang baru saja
 * diupload admin) ke cache, sekalian pakai URL publiknya sebagai kunci.
 * Efeknya: file yang barusan diupload tidak perlu diunduh ulang.
 */
export async function putMediaBlob(url, blob, ttl = DEFAULT_MEDIA_TTL) {
  if (!url || !blob) return '';
  const key = cacheKeyFor(url);
  try {
    await idbPut(STORE_MEDIA, {
      key, url, blob,
      mime: blob.type,
      size: blob.size,
      storedAt: Date.now(),
      lastUsed: Date.now(),
      hits: 0,
      ttl,
    });
  } catch { /* kuota penuh — abaikan */ }
  return registerObjectUrl(key, blob);
}

async function fetchBlob(url, { signal, onProgress, maxBytes = 0 } = {}) {
  const res = await fetch(url, { signal, cache: 'force-cache', credentials: 'omit' });
  if (!res.ok) throw new Error(`Gagal mengunduh media (${res.status})`);

  const declared = Number(res.headers.get('content-length') || 0);
  if (maxBytes && declared && declared > maxBytes) {
    try { res.body?.cancel(); } catch { /* abaikan */ }
    return null; // terlalu besar untuk disimpan
  }

  if (!res.body || typeof onProgress !== 'function') {
    const blob = await res.blob();
    if (maxBytes && blob.size > maxBytes) return null;
    return blob;
  }

  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (maxBytes && received > maxBytes) {
      try { await reader.cancel(); } catch { /* abaikan */ }
      return null;
    }
    if (declared) onProgress(Math.min(1, received / declared));
  }
  onProgress(1);
  return new Blob(chunks, {
    type: res.headers.get('content-type') || 'application/octet-stream',
  });
}

/**
 * Kembalikan URL yang aman dipasang ke <img src> / <video src>.
 * Sudah ada di device → blob: URL (nol byte ke Supabase).
 * Gagal apa pun → URL asli, jadi tampilan tidak pernah rusak.
 */
export async function getCachedMediaUrl(url, opts = {}) {
  const { ttl = DEFAULT_MEDIA_TTL, maxBytes = 0, signal, onProgress } = opts;

  if (!url) return '';
  if (typeof url !== 'string') return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  const key = cacheKeyFor(url);
  const live = liveUrls.get(key);
  if (live) return live;

  try {
    const rec = await idbGet(STORE_MEDIA, key);
    if (rec && rec.blob && Date.now() - rec.storedAt < (rec.ttl || ttl)) {
      touch(key);
      return registerObjectUrl(key, rec.blob);
    }
  } catch { /* lanjut ke jaringan */ }

  try {
    const blob = await fetchBlob(url, { signal, onProgress, maxBytes });
    if (!blob) return url; // terlalu besar → streaming langsung dari Supabase
    idbPut(STORE_MEDIA, {
      key, url, blob,
      mime: blob.type,
      size: blob.size,
      storedAt: Date.now(),
      lastUsed: Date.now(),
      hits: 1,
      ttl,
    }).catch(() => { /* kuota penuh — abaikan */ });
    return registerObjectUrl(key, blob);
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    return url;
  }
}

/** Unduh di latar belakang, maksimal 2 sekaligus supaya tidak merebut bandwidth. */
export async function prefetchMedia(urls = [], opts = {}) {
  const list = urls.filter(Boolean);
  let i = 0;
  const worker = async () => {
    while (i < list.length) {
      const url = list[i++];
      try {
        if (await hasCachedMedia(url)) continue;
        await getCachedMediaUrl(url, opts);
      } catch { /* abaikan */ }
    }
  };
  await Promise.all([worker(), worker()]);
}

/* ------------------------------------------------------------------ */
/* Pemeliharaan                                                        */
/* ------------------------------------------------------------------ */

export async function pruneExpired() {
  let removed = 0;
  try {
    const all = await idbAll(STORE_MEDIA);
    const now = Date.now();
    for (const rec of all) {
      if (now - rec.storedAt >= (rec.ttl || DEFAULT_MEDIA_TTL)) {
        await idbDelete(STORE_MEDIA, rec.key);
        removed++;
      }
    }
  } catch { /* abaikan */ }
  return removed;
}

/** Buang entri paling lama tidak dipakai sampai total di bawah jatah. */
export async function pruneToBudget(budget = DEFAULT_BUDGET_BYTES) {
  let removed = 0;
  try {
    const all = await idbAll(STORE_MEDIA);
    let total = all.reduce((n, r) => n + (r.size || 0), 0);
    if (total <= budget) return 0;
    all.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
    for (const rec of all) {
      if (total <= budget) break;
      await idbDelete(STORE_MEDIA, rec.key);
      total -= rec.size || 0;
      removed++;
    }
  } catch { /* abaikan */ }
  return removed;
}

export async function clearMediaCache() {
  releaseAllObjectUrls();
  try { await idbClear(STORE_MEDIA); } catch { /* abaikan */ }
}

export async function getCacheStats() {
  const out = {
    persisted: false,
    quotaBytes: 0,
    usageBytes: 0,
    mediaCount: 0,
    mediaBytes: 0,
    oldestStoredAt: null,
    newestStoredAt: null,
    items: [],
  };
  try {
    if (navigator.storage && navigator.storage.persisted) {
      out.persisted = await navigator.storage.persisted();
    }
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      out.quotaBytes = est.quota || 0;
      out.usageBytes = est.usage || 0;
    }
  } catch { /* abaikan */ }
  try {
    const all = await idbAll(STORE_MEDIA);
    out.mediaCount = all.length;
    out.mediaBytes = all.reduce((n, r) => n + (r.size || 0), 0);
    if (all.length) {
      out.oldestStoredAt = Math.min(...all.map((r) => r.storedAt));
      out.newestStoredAt = Math.max(...all.map((r) => r.storedAt));
      out.items = all
        .map((r) => ({
          key: r.key,
          size: r.size,
          mime: r.mime,
          storedAt: r.storedAt,
          lastUsed: r.lastUsed,
          hits: r.hits || 0,
          expiresAt: r.storedAt + (r.ttl || DEFAULT_MEDIA_TTL),
        }))
        .sort((a, b) => b.size - a.size);
    }
  } catch { /* abaikan */ }
  return out;
}

/**
 * Minta browser menandai penyimpanan sebagai permanen.
 * Chrome memberikannya otomatis kalau situs di-bookmark / sering dikunjungi /
 * dipasang sebagai PWA. Kalau ditolak, cache tetap jalan — hanya saja bisa
 * dibersihkan browser waktu disk menipis.
 */
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Panggil sekali saat aplikasi start (lihat main.jsx). */
export async function initMediaCache(opts = {}) {
  const { budget = DEFAULT_BUDGET_BYTES } = opts;
  const persisted = await requestPersistentStorage();
  const run = () => {
    pruneExpired().then(() => pruneToBudget(budget)).catch(() => {});
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 5000 });
  else setTimeout(run, 3000);
  return { persisted };
}
