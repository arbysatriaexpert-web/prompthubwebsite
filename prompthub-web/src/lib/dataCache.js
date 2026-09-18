/**
 * dataCache.js — PromptHub v5.5
 *
 * Cache hasil query Supabase (baris tabel, bukan file) di device.
 * Pola yang dipakai: stale-while-revalidate.
 *
 *   freshMs  → di bawah ini data dianggap segar. TIDAK ada request sama sekali.
 *   maxMs    → di atas ini data dibuang, wajib ambil ulang.
 *   di antara → data lama langsung dipakai untuk render, lalu satu request
 *               latar belakang menyegarkan cache.
 *
 * Dipakai di prompthub-web MAUPUN prompthub-admin. Di admin, ini yang membuat
 * daftar (project, artikel, kategori, slide) tersimpan di device admin sendiri,
 * jadi buka-tutup panel tidak terus-terusan memakan egress.
 */

import { STORE_DATA, idbGet, idbPut, idbDelete, idbAll, idbClear, DAY } from './mediaCache';

export { DAY };

/**
 * Naikkan angka ini tiap kali bentuk data berubah (kolom ditambah/dihapus).
 * Semua cache lama otomatis dianggap tidak valid.
 */
export const CACHE_SCHEMA_VERSION = 5;

export const FRESH_SHORT = 5 * 60 * 1000;    // 5 menit — daftar yang sering berubah
export const FRESH_MEDIUM = 30 * 60 * 1000;  // 30 menit
export const FRESH_LONG = 6 * 60 * 60 * 1000; // 6 jam — kategori, site_settings
export const MAX_AGE_DEFAULT = 30 * DAY;

const memory = new Map(); // cache tingkat-1, hilang saat reload

function fullKey(key) {
  return `v${CACHE_SCHEMA_VERSION}:${key}`;
}

export async function readCache(key) {
  const k = fullKey(key);
  const mem = memory.get(k);
  if (mem) return mem;
  try {
    const rec = await idbGet(STORE_DATA, k);
    if (!rec) return null;
    memory.set(k, rec);
    return rec;
  } catch {
    return null;
  }
}

export async function writeCache(key, value) {
  const k = fullKey(key);
  const rec = { key: k, value, storedAt: Date.now() };
  memory.set(k, rec);
  try { await idbPut(STORE_DATA, rec); } catch { /* kuota penuh — abaikan */ }
  return rec;
}

export async function dropCache(prefix = '') {
  const p = fullKey(prefix);
  for (const k of [...memory.keys()]) if (k.startsWith(p)) memory.delete(k);
  try {
    const all = await idbAll(STORE_DATA);
    for (const rec of all) if (rec.key.startsWith(p)) await idbDelete(STORE_DATA, rec.key);
  } catch { /* abaikan */ }
}

export async function clearDataCache() {
  memory.clear();
  try { await idbClear(STORE_DATA); } catch { /* abaikan */ }
}

export async function getDataCacheStats() {
  try {
    const all = await idbAll(STORE_DATA);
    const bytes = all.reduce((n, r) => {
      try { return n + JSON.stringify(r.value).length; } catch { return n; }
    }, 0);
    const storedAts = all.map((r) => r.storedAt).filter(Boolean);
    return {
      count: all.length,
      approxBytes: bytes,
      oldestStoredAt: storedAts.length ? Math.min(...storedAts) : null,
      newestStoredAt: storedAts.length ? Math.max(...storedAts) : null,
    };
  } catch {
    return { count: 0, approxBytes: 0, oldestStoredAt: null, newestStoredAt: null };
  }
}

/**
 * Inti stale-while-revalidate.
 *
 * onRevalidated(data) dipanggil hanya kalau penyegaran latar belakang
 * menghasilkan data yang BERBEDA — pakai untuk setState di komponen.
 *
 * @returns {Promise<{data:any, fromCache:boolean, stale:boolean, storedAt:number}>}
 */
export async function swrQuery(key, fetcher, opts = {}) {
  const {
    freshMs = FRESH_SHORT,
    maxMs = MAX_AGE_DEFAULT,
    force = false,
    onRevalidated,
  } = opts;

  const now = Date.now();
  const rec = force ? null : await readCache(key);

  if (rec) {
    const age = now - rec.storedAt;
    if (age < freshMs) {
      return { data: rec.value, fromCache: true, stale: false, storedAt: rec.storedAt };
    }
    if (age < maxMs) {
      Promise.resolve()
        .then(fetcher)
        .then(async (fresh) => {
          if (fresh === undefined || fresh === null) return;
          let changed = true;
          try { changed = JSON.stringify(fresh) !== JSON.stringify(rec.value); } catch { /* biarkan */ }
          await writeCache(key, fresh);
          if (changed && typeof onRevalidated === 'function') onRevalidated(fresh);
        })
        .catch(() => { /* offline — biarkan data lama */ });
      return { data: rec.value, fromCache: true, stale: true, storedAt: rec.storedAt };
    }
  }

  const fresh = await fetcher();
  if (fresh !== undefined && fresh !== null) await writeCache(key, fresh);
  return { data: fresh, fromCache: false, stale: false, storedAt: now };
}

/** Kunci stabil dari objek parameter (urutan properti tidak berpengaruh). */
export function makeKey(namespace, params = {}) {
  const parts = Object.keys(params)
    .sort()
    .map((k) => {
      const v = params[k];
      if (v === undefined || v === null || v === '') return null;
      return `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`;
    })
    .filter(Boolean);
  return `${namespace}:${parts.join('&')}`;
}
