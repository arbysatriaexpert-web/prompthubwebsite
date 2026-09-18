import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * v5.5 — pemisahan bundel.
 *
 * Tanpa manualChunks, React + Router + Supabase + lucide-react menumpuk jadi
 * satu file besar yang harus diunduh ulang setiap kali ada perubahan kode
 * halaman. Dipisah begini, vendor jarang berubah sehingga tetap terpakai dari
 * cache browser setelah deploy baru — hemat kuota Netlify dan mempercepat
 * kunjungan berikutnya.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 700,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-router')) return 'vendor-router'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('lucide-react')) return 'vendor-icons'
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('scheduler')) {
            return 'vendor-react'
          }
          return 'vendor'
        },
      },
    },
  },
})
