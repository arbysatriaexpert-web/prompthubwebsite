import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings, SiteLogo } from '../../contexts/SettingsContext'
import { Home, Wrench, Newspaper, Lightbulb, User, MessageCircle } from 'lucide-react'
import PopupBanner from '../../components/PopupBanner'
import './UserLayout.css'

export default function UserLayout() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // FIX: satu sumber setting untuk WA + logo + nama situs (tidak fetch berulang)
  const { settings } = useSettings()
  const waNumber = settings?.whatsapp_number || ''
  const siteName = settings?.site_name || 'PromptHub'

  const isRestricted = location.pathname !== '/'
  const showLock = !user && isRestricted

  return (
    <div className="user-layout">
      {/* Header */}
      <header className="user-header">
        <div className="logo" onClick={() => navigate('/')}>
          <SiteLogo className="logo-icon" />
          <span className="logo-text">{siteName}</span>
        </div>
        <nav className="desktop-nav">
          <NavLink to="/" end className={({ isActive }) => `d-nav-item ${isActive ? 'active' : ''}`}>Home</NavLink>
          <NavLink to="/tools" className={({ isActive }) => `d-nav-item ${isActive ? 'active' : ''}`}>Tools Prompt</NavLink>
          <NavLink to="/info" className={({ isActive }) => `d-nav-item ${isActive ? 'active' : ''}`}>Info AI</NavLink>
          <NavLink to="/tips" className={({ isActive }) => `d-nav-item ${isActive ? 'active' : ''}`}>Tips</NavLink>
          <NavLink to="/akun" className={({ isActive }) => `d-nav-item ${isActive ? 'active' : ''}`}>Akun</NavLink>
        </nav>

        <div className="header-right">
          {user ? (
            <span className="user-greeting">Halo, {profile?.display_name || 'User'} 👋</span>
          ) : (
            <button className="btn-login" onClick={() => navigate('/login')}>Login</button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="user-content" style={{ position: 'relative' }}>
        <div
          aria-hidden={showLock}
          style={showLock ? { filter: 'blur(8px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.4, minHeight: '80vh' } : {}}
        >
          <Outlet />
        </div>

        {showLock && (
          <div
            className="login-overlay"
            style={{
              /* FIX: fixed + clamp supaya modal tidak kepotong di layar pendek
                 dan tidak tertutup bottom-nav */
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              textAlign: 'center',
              background: 'rgba(20, 20, 20, 0.92)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '24px',
              borderRadius: '16px',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              width: 'min(85%, 320px)',
              maxHeight: 'calc(100dvh - 160px)',
              overflowY: 'auto',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
            <h3 style={{ color: 'white', marginBottom: '8px', fontSize: '18px', fontWeight: 600 }}>Akses Terbatas</h3>
            <p style={{ color: '#a1a1aa', marginBottom: '20px', fontSize: '13px', lineHeight: 1.5 }}>
              Silakan login secara gratis untuk mengakses semua fitur {siteName}.
            </p>
            <button className="btn btn-primary w-full" onClick={() => navigate('/login')}>
              Login Sekarang
            </button>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Home size={20} /><span>Home</span>
        </NavLink>
        <NavLink to="/tools" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Wrench size={20} /><span>Tools Prompt</span>
        </NavLink>
        <NavLink to="/info" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Newspaper size={20} /><span>Info AI</span>
        </NavLink>
        <NavLink to="/tips" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Lightbulb size={20} /><span>Tips</span>
        </NavLink>
        <NavLink to="/akun" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <User size={20} /><span>Akun</span>
        </NavLink>
      </nav>

      {/* Floating WhatsApp Button */}
      {waNumber && (
        <a
          href={`https://wa.me/${waNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="floating-wa-btn"
          title="Hubungi Admin di WhatsApp"
        >
          <MessageCircle size={24} />
        </a>
      )}

      {/* Popup Banner — hanya untuk user yang sudah login */}
      {user && <PopupBanner />}
    </div>
  )
}
