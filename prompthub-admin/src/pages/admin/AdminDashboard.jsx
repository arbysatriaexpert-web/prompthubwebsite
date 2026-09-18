import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    setLoading(true)
    setError(null)
    try {
      const [
        { count: projectCount },
        { count: memberCount },
        { count: requestPending },
        { count: articleCount },
        { count: categoryCount },
        { count: slideCount },
      ] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'member'),
        supabase.from('feedback_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('articles').select('id', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('hero_slides').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ])

      setStats({
        projects: projectCount || 0,
        members: memberCount || 0,
        pendingRequests: requestPending || 0,
        articles: articleCount || 0,
        categories: categoryCount || 0,
        slides: slideCount || 0,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const statCards = stats ? [
    { emoji: '📦', label: 'Project Published', value: stats.projects, color: 'var(--accent)' },
    { emoji: '👥', label: 'Member Aktif', value: stats.members, color: '#10b981' },
    { emoji: '📩', label: 'Request Pending', value: stats.pendingRequests, color: '#f59e0b' },
    { emoji: '📰', label: 'Artikel Published', value: stats.articles, color: '#8b5cf6' },
    { emoji: '🏷️', label: 'Kategori', value: stats.categories, color: '#ec4899' },
    { emoji: '🖼️', label: 'Slide Aktif', value: stats.slides, color: '#06b6d4' },
  ] : []

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">📊 Dashboard</h1>
        <button className="btn btn-ghost btn-sm" onClick={fetchStats} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="stats-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="stat-card" style={{ opacity: 0.5 }}>
              <div className="stat-value" style={{ 
                width: '40px', height: '28px', background: 'var(--bg-card)', borderRadius: '6px' 
              }} />
              <div className="stat-label" style={{ 
                width: '80px', height: '14px', background: 'var(--bg-card)', borderRadius: '4px', marginTop: '4px' 
              }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <div className="empty-text">Gagal memuat data: {error}</div>
          <button className="btn btn-primary btn-sm" onClick={fetchStats} style={{ marginTop: '8px' }}>
            Coba Lagi
          </button>
        </div>
      ) : (
        <div className="stats-grid">
          {statCards.map(card => (
            <div key={card.label} className="stat-card">
              <div className="stat-value" style={{ color: card.color }}>
                {card.emoji} {card.value}
              </div>
              <div className="stat-label">{card.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
