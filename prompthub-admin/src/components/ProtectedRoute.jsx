import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * ProtectedRoute v5 — permission-based route guard.
 * 
 * Props:
 * - requireAdmin: true = butuh role admin/architect
 * - requiredPermission: string = nama permission spesifik (e.g. 'can_manage_projects')
 * 
 * Logic:
 * - Belum login → redirect ke /login
 * - Login tapi bukan admin/architect → 403
 * - Login tapi tidak punya permission → 403
 * - Architect → selalu lolos
 */
export default function ProtectedRoute({ children, requireAdmin = false, requiredPermission }) {
  const { user, profile, loading, isAdminOrAbove, hasPermission } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: 'var(--text-muted)',
        fontSize: '13px'
      }}>
        Memuat...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Cek role admin/architect
  if (requireAdmin && !isAdminOrAbove) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: 'var(--text-muted)',
        fontSize: '14px',
        gap: '12px',
        padding: '20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px' }}>🚫</div>
        <h2 style={{ color: 'var(--text-white)', fontSize: '18px', margin: 0 }}>
          403 — Akses Ditolak
        </h2>
        <p style={{ maxWidth: '400px', lineHeight: 1.6 }}>
          Kamu tidak memiliki izin untuk mengakses halaman ini. 
          Hubungi Architect jika kamu memerlukan akses.
        </p>
      </div>
    )
  }

  // Cek permission spesifik
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: 'var(--text-muted)',
        fontSize: '14px',
        gap: '12px',
        padding: '20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px' }}>🔒</div>
        <h2 style={{ color: 'var(--text-white)', fontSize: '18px', margin: 0 }}>
          Tidak Punya Akses
        </h2>
        <p style={{ maxWidth: '400px', lineHeight: 1.6 }}>
          Kamu tidak memiliki permission <code style={{ 
            background: 'var(--bg-card)', 
            padding: '2px 6px', 
            borderRadius: '4px',
            fontSize: '12px'
          }}>{requiredPermission}</code> untuk mengakses menu ini.
        </p>
      </div>
    )
  }

  return children
}
