import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * ProtectedRoute — cek apakah user sudah login.
 * Jika requireAdmin=true, juga cek apakah role-nya admin.
 */
export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, profile, loading, isAdmin } = useAuth()

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

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}
