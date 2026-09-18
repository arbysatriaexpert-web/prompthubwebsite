import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initMediaCache } from './lib/mediaCache'

/**
 * v5.5 — minta browser menjadikan penyimpanan situs ini permanen, lalu
 * bersihkan entri cache yang sudah kedaluwarsa / melebihi jatah 300 MB.
 * Dijalankan sekali saat start, tidak menahan render pertama.
 */
initMediaCache().catch(() => { /* browser lama — abaikan */ })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
