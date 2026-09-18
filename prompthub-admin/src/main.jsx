import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initMediaCache } from './lib/mediaCache'

/**
 * v5.5 — panel admin ikut menyimpan media & daftar data di device admin.
 * Jatah cache dibuat lebih kecil dari sisi web (150 MB) karena panel lebih
 * sering melihat banyak thumbnail sekaligus tapi jarang memutar videonya.
 */
initMediaCache({ budget: 150 * 1024 * 1024 }).catch(() => {})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
