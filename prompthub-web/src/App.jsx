import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'

// Components
import UserLayout from './layouts/UserLayout/UserLayout'

// Pages
import LoginPage from './pages/LoginPage/LoginPage'
import HomePage from './pages/HomePage'
import ToolsPage from './pages/ToolsPage'
import ToolDetailPage from './pages/ToolDetailPage/ToolDetailPage'
import InfoPage from './pages/InfoPage'
import TipsPage from './pages/TipsPage'
import AkunPage from './pages/AkunPage'
import ArticleDetailPage from './pages/ArticleDetailPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
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
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
