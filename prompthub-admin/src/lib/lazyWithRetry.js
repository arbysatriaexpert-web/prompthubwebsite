/**
 * lazyWithRetry.js — PromptHub v5.5
 *
 * React.lazy memecah bundel jadi banyak file kecil. Efek sampingnya:
 * kalau user membuka tab lama lalu Netlify sudah men-deploy versi baru,
 * nama file chunk sudah berganti dan import dinamis gagal dengan
 * "Failed to fetch dynamically imported module" — halaman jadi putih.
 *
 * Helper ini menangkap kasus itu dan memuat ulang halaman SATU KALI.
 * Kalau setelah reload masih gagal, error dilempar seperti biasa supaya
 * tidak terjadi loop reload tak berujung.
 */

import { lazy } from 'react';

const FLAG_PREFIX = 'ph:chunk-reload:';

export function lazyWithRetry(factory, name = 'chunk') {
  return lazy(() =>
    factory()
      .then((mod) => {
        try { sessionStorage.removeItem(FLAG_PREFIX + name); } catch { /* abaikan */ }
        return mod;
      })
      .catch((err) => {
        let alreadyTried = false;
        try { alreadyTried = !!sessionStorage.getItem(FLAG_PREFIX + name); } catch { /* abaikan */ }

        if (!alreadyTried) {
          try { sessionStorage.setItem(FLAG_PREFIX + name, '1'); } catch { /* abaikan */ }
          window.location.reload();
          // Promise yang tidak pernah selesai: cegah React merender error
          // sekejap sebelum browser sempat memuat ulang.
          return new Promise(() => {});
        }
        throw err;
      }),
  );
}

export default lazyWithRetry;
