import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { SiteLogo, SiteName } from '../../contexts/SettingsContext'
import {
  LayoutDashboard, FolderOpen, Tag, FileText,
  Image, Users, MessageSquare, Settings, LogOut, Megaphone
} from 'lucide-react'
import './AdminLayout.css'

// Menu items with permission mapping
const MENU_ITEMS = [
  { to: '/admin', end: true, icon: LayoutDashboard, label: 'Dashboard', permission: 'can_view_dashboard' },
  { to: '/admin/projects', icon: FolderOpen, label: 'Project', permission: 'can_manage_projects' },
  { to: '/admin/categories', icon: Tag, label: 'Kategori', permission: 'can_manage_categories' },
  { to: '/admin/articles', icon: FileText, label: 'Artikel', permission: 'can_manage_articles' },
  { to: '/admin/slides', icon: Image, label: 'Hero Slides', permission: 'can_manage_slides' },
  { to: '/admin/users', icon: Users, label: 'Kelola User', permission: 'can_manage_users' },
  { to: '/admin/requests', icon: MessageSquare, label: 'Request Masuk', permission: 'can_manage_requests' },
  { to: '/admin/popup-banners', icon: Megaphone, label: 'Popup Banner', permission: 'can_manage_popup_banners' },
  { to: '/admin/settings', icon: Settings, label: 'Pengaturan', permission: 'can_manage_settings' },
]

export default function AdminLayout() {
  const { profile, isArchitect, hasPermission, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const roleBadge = isArchitect ? 'ARCHITECT' : 'ADMIN'
  const roleLabel = isArchitect ? 'Architect' : 'Administrator'

  const visibleMenuItems = MENU_ITEMS.filter(item => hasPermission(item.permission))

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          {/* FIX: logo diambil dari site_settings.logo_url, bukan hardcode "P" */}
          <SiteLogo className="logo-icon" />
          <SiteName className="logo-text" />
          <span className={`admin-badge ${isArchitect ? 'badge-architect' : ''}`}>{roleBadge}</span>
        </div>

        <nav className="admin-nav">
          {visibleMenuItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <span className="admin-user-name">{profile?.display_name || 'Admin'}</span>
            <span className="admin-user-role">{roleLabel}</span>
          </div>
          <button className="admin-logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  )
}
