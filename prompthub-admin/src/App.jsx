import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { ToastProvider } from './components/Toast'
import ProtectedRoute from './components/ProtectedRoute'

// Layouts
import AdminLayout from './layouts/AdminLayout/AdminLayout'

// Pages
import LoginPage from './pages/LoginPage/LoginPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminCategories from './pages/admin/AdminCategories'
import AdminProjects from './pages/admin/AdminProjects'
import AdminArticles from './pages/admin/AdminArticles'
import AdminSlides from './pages/admin/AdminSlides'
import AdminUsers from './pages/admin/AdminUsers'
import AdminRequests from './pages/admin/AdminRequests'
import AdminSettings from './pages/admin/AdminSettings'
import AdminPopupBanners from './pages/admin/AdminPopupBanners'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
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
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
