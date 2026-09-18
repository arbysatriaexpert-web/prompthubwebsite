import { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { ToastProvider } from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'
import { lazyWithRetry } from './lib/lazyWithRetry'
import RouteFallback from './components/RouteFallback'

// Layout dipakai semua rute admin, jadi tetap ikut bundel utama.
import AdminLayout from './layouts/AdminLayout/AdminLayout'

/**
 * v5.5 — CODE SPLITTING PER HALAMAN
 *
 * Panel ini paling untung dari code splitting: AdminProjects saja 620 baris,
 * dan seorang admin yang hanya mengurus artikel dulunya tetap mengunduh
 * seluruh kode halaman user, kategori, slide, popup, dan pengaturan.
 * Sekarang tiap halaman jadi chunk sendiri dan hanya diunduh saat dibuka.
 */
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage/LoginPage'), 'login')
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard'), 'dashboard')
const AdminCategories = lazyWithRetry(() => import('./pages/admin/AdminCategories'), 'categories')
const AdminProjects = lazyWithRetry(() => import('./pages/admin/AdminProjects'), 'projects')
const AdminArticles = lazyWithRetry(() => import('./pages/admin/AdminArticles'), 'articles')
const AdminSlides = lazyWithRetry(() => import('./pages/admin/AdminSlides'), 'slides')
const AdminUsers = lazyWithRetry(() => import('./pages/admin/AdminUsers'), 'users')
const AdminRequests = lazyWithRetry(() => import('./pages/admin/AdminRequests'), 'requests')
const AdminSettings = lazyWithRetry(() => import('./pages/admin/AdminSettings'), 'settings')
const AdminPopupBanners = lazyWithRetry(() => import('./pages/admin/AdminPopupBanners'), 'popup')

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Default Route redirect to login */}
                <Route path="/" element={<Navigate to="/login" replace />} />

                <Route path="/login" element={<LoginPage />} />

                {/* Admin Panel — requireAdmin cek role, requiredPermission cek per menu */}
                <Route element={
                  <ProtectedRoute requireAdmin>
                    <AdminLayout />
                  </ProtectedRoute>
                }>
                  <Route path="/admin" element={
                    <ProtectedRoute requiredPermission="can_view_dashboard">
                      <AdminDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/projects" element={
                    <ProtectedRoute requiredPermission="can_manage_projects">
                      <AdminProjects />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/categories" element={
                    <ProtectedRoute requiredPermission="can_manage_categories">
                      <AdminCategories />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/articles" element={
                    <ProtectedRoute requiredPermission="can_manage_articles">
                      <AdminArticles />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/slides" element={
                    <ProtectedRoute requiredPermission="can_manage_slides">
                      <AdminSlides />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/users" element={
                    <ProtectedRoute requiredPermission="can_manage_users">
                      <AdminUsers />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/requests" element={
                    <ProtectedRoute requiredPermission="can_manage_requests">
                      <AdminRequests />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/popup-banners" element={
                    <ProtectedRoute requiredPermission="can_manage_popup_banners">
                      <AdminPopupBanners />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/settings" element={
                    <ProtectedRoute requiredPermission="can_manage_settings">
                      <AdminSettings />
                    </ProtectedRoute>
                  } />
                </Route>

                {/* Fallback: rute tidak dikenal -> login */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
