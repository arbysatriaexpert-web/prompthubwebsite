import { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { lazyWithRetry } from './lib/lazyWithRetry'
import RouteFallback from './components/RouteFallback'

// Layout dipakai di hampir semua rute, jadi tetap ikut bundel utama.
import UserLayout from './layouts/UserLayout/UserLayout'

/**
 * v5.5 — CODE SPLITTING PER HALAMAN
 *
 * Sebelumnya seluruh halaman diimpor statis, sehingga satu file JS berisi
 * semua halaman diunduh pengunjung walau ia hanya membuka Home. Dengan
 * React.lazy, tiap halaman jadi chunk terpisah dan baru diunduh saat rutenya
 * dibuka. Chunk-nya ber-hash dan di-cache setahun oleh Netlify (netlify.toml),
 * jadi hanya diunduh sekali per versi.
 *
 * lazyWithRetry menangani kasus tab lama + deploy baru: nama chunk berubah,
 * import gagal, halaman di-reload sekali secara otomatis.
 */
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage/LoginPage'), 'login')
const HomePage = lazyWithRetry(() => import('./pages/HomePage'), 'home')
const ToolsPage = lazyWithRetry(() => import('./pages/ToolsPage'), 'tools')
const ToolDetailPage = lazyWithRetry(() => import('./pages/ToolDetailPage/ToolDetailPage'), 'tool-detail')
const InfoPage = lazyWithRetry(() => import('./pages/InfoPage'), 'info')
const TipsPage = lazyWithRetry(() => import('./pages/TipsPage'), 'tips')
const AkunPage = lazyWithRetry(() => import('./pages/AkunPage'), 'akun')
const ArticleDetailPage = lazyWithRetry(() => import('./pages/ArticleDetailPage'), 'artikel')

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              {/* User Website (dengan UserLayout) */}
              <Route element={<UserLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/tools" element={<ToolsPage />} />
                <Route path="/tools/:id" element={<ToolDetailPage />} />
                <Route path="/info" element={<InfoPage />} />
                <Route path="/tips" element={<TipsPage />} />
                <Route path="/artikel/:id" element={<ArticleDetailPage />} />
                <Route path="/akun" element={<AkunPage />} />
              </Route>

              {/* Fallback: rute tidak dikenal -> Home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
