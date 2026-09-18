import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { UserPlus, Key, ShieldCheck, ShieldOff } from 'lucide-react'
import './AdminCrud.css'
import { useToast } from '../../components/Toast'

const PERMISSION_LABELS = {
  can_view_dashboard: '📊 Dashboard',
  can_manage_projects: '📦 Project',
  can_manage_categories: '🏷️ Kategori',
  can_manage_articles: '📰 Artikel',
  can_manage_slides: '🖼️ Hero Slides',
  can_manage_requests: '📩 Request',
  can_manage_users: '👥 Kelola User',
  can_manage_settings: '⚙️ Pengaturan',
  can_manage_popup_banners: '🎯 Popup Banner',
}

export default function AdminUsers() {
  const { toast } = useToast()
  const { isArchitect, user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', display_name: '', role: 'member' })
  const [permForm, setPermForm] = useState({})
  // Shim: semua setMessage lama sekarang tampil sebagai toast melayang
  const setMessage = (m) => {
    if (!m) return
    const ok = m.startsWith('✅')
    toast(m.replace(/^[✅❌]\s*/, ''), ok ? 'success' : 'error', 5000)
  }

  // Edit permission modal
  const [editPermTarget, setEditPermTarget] = useState(null)
  const [editPerms, setEditPerms] = useState({})

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setUsers(data || [])
    setLoading(false)
  }

  // ── Create User via Edge Function ──
  async function handleCreateUser() {
    if (!form.email || !form.password || !form.display_name) {
      return setMessage('Semua field wajib diisi!')
    }
    if (form.password.length < 6) {
      return setMessage('Password minimal 6 karakter!')
    }

    setCreating(true)
    setMessage('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            display_name: form.display_name,
            role: form.role,
          }),
        }
      )
      const result = await res.json()

      if (!res.ok) {
        setMessage(`❌ ${result.error}`)
      } else {
        setMessage(`✅ ${result.message}`)
        setForm({ email: '', password: '', display_name: '', role: 'member' })
        setPermForm({})
        setShowForm(false)
        fetchUsers()
      }
    } catch (err) {
      setMessage(`❌ Gagal: ${err.message}`)
    }
    setCreating(false)
  }

  // ── Delete User via Edge Function ──
  async function handleDeleteUser(user) {
    if (!confirm(`🚨 PERINGATAN! Yakin ingin menghapus permanen akun ${user.display_name}? Ini tidak bisa dibatalkan!`)) return

    setCreating(true)
    setMessage('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ user_id: user.id }),
        }
      )
      const result = await res.json()
      if (!res.ok) {
        setMessage(`❌ ${result.error}`)
      } else {
        setMessage(`✅ Akun ${user.display_name} berhasil dihapus permanen!`)
        fetchUsers()
      }
    } catch (err) {
      setMessage(`❌ Gagal: ${err.message}`)
    }
    setCreating(false)
  }

  // ── Edit Permission (architect only) ──
  async function openEditPermission(user) {
    setEditPermTarget(user)
    // Fetch current permissions
    const { data } = await supabase
      .from('admin_permissions')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (data) {
      setEditPerms(data)
    } else {
      // No permission row yet — all false
      const defaultPerms = {}
      Object.keys(PERMISSION_LABELS).forEach(k => defaultPerms[k] = false)
      setEditPerms(defaultPerms)
    }
  }

  async function savePermissions() {
    if (!editPermTarget) return
    setCreating(true)

    const permData = {}
    Object.keys(PERMISSION_LABELS).forEach(k => {
      permData[k] = editPerms[k] === true
    })

    // Upsert
    const { error } = await supabase
      .from('admin_permissions')
      .upsert({ user_id: editPermTarget.id, ...permData }, { onConflict: 'user_id' })

    if (error) {
      setMessage(`❌ Gagal: ${error.message}`)
    } else {
      setMessage(`✅ Permission ${editPermTarget.display_name} berhasil diupdate`)
      setEditPermTarget(null)
    }
    setCreating(false)
  }

  // Role badge colors
  const roleBadge = (role) => {
    if (role === 'architect') return 'badge-green'
    if (role === 'admin') return 'badge-amber'
    return 'badge-accent'
  }

  // Allowed roles to create
  const roleOptions = isArchitect
    ? ['member', 'admin', 'architect']
    : ['member']

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">👥 Kelola User</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <UserPlus size={16} /> Buat Akun
        </button>
      </div>


      {/* Create User Form */}
      {showForm && (
        <div className="crud-form card">
          <h3 className="crud-form-title">Buat Akun Baru</h3>
          <div className="crud-form-grid">
            <div className="field-group">
              <label className="field-label">Nama Lengkap</label>
              <input className="input" value={form.display_name} onChange={e => setForm({...form, display_name: e.target.value})} placeholder="Andi Pratama" />
            </div>
            <div className="field-group">
              <label className="field-label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="andi@email.com" />
            </div>
            <div className="field-group">
              <label className="field-label">Password</label>
              <input className="input" type="text" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Min. 6 karakter" />
            </div>
            <div className="field-group">
              <label className="field-label">Role</label>
              <select className="select" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                {roleOptions.map(r => (
                  <option key={r} value={r}>
                    {r === 'architect' ? '🔑 Architect (Full Access)' : r === 'admin' ? '🛡️ Admin (Permission-based)' : '👤 Member'}
                  </option>
                ))}
              </select>
              {form.role === 'architect' && (
                <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>
                  ⚠️ Architect punya akses penuh ke seluruh sistem. Yakin?
                </p>
              )}
            </div>
          </div>
          <div className="crud-form-actions">
            <button className="btn btn-primary" onClick={handleCreateUser} disabled={creating}>
              {creating ? 'Membuat...' : '✅ Buat Akun'}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Batal</button>
          </div>
        </div>
      )}


      {/* Edit Permission Modal (Architect Only) */}
      {editPermTarget && (
        <div className="crud-form card">
          <h3 className="crud-form-title">🛡️ Permission: {editPermTarget.display_name}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
              <label key={key} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 12px', borderRadius: '8px',
                background: editPerms[key] ? 'rgba(16,185,129,0.1)' : 'var(--bg-card)',
                border: `1px solid ${editPerms[key] ? 'rgba(16,185,129,0.3)' : 'var(--border-subtle)'}`,
                cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)',
                transition: 'all 0.2s',
              }}>
                <input
                  type="checkbox"
                  checked={editPerms[key] === true}
                  onChange={e => setEditPerms({...editPerms, [key]: e.target.checked})}
                  style={{ accentColor: 'var(--accent)' }}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="crud-form-actions" style={{ marginTop: '12px' }}>
            <button className="btn btn-primary" onClick={savePermissions} disabled={creating}>
              {creating ? 'Menyimpan...' : '💾 Simpan Permission'}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditPermTarget(null)}>Batal</button>
          </div>
        </div>
      )}

      {/* User Table */}
      {loading ? <p style={{ color: 'var(--text-muted)' }}>Memuat...</p> : (
        <table className="admin-table">
          <thead><tr><th>Nama</th><th>Role</th><th>Status</th><th>Terdaftar</th><th>Aksi</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.display_name || '—'}</td>
                <td>
                  <span className={`badge ${roleBadge(u.role)}`}>{u.role}</span>
                </td>
                <td>
                  {u.is_active === false
                    ? <span className="badge badge-red">Nonaktif</span>
                    : <span className="badge badge-green" style={{ opacity: 0.7 }}>Aktif</span>
                  }
                </td>
                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {new Date(u.created_at).toLocaleDateString('id-ID')}
                </td>
                <td>
                  <div className="actions">
                    {/* Edit Permission — hanya architect, hanya untuk role admin */}
                    {isArchitect && u.role === 'admin' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditPermission(u)} title="Edit Permission">
                        <ShieldCheck size={14} />
                      </button>
                    )}
                    {/* Delete Account — jangan untuk diri sendiri atau architect (jika bukan architect) */}
                    {u.id !== currentUser?.id && u.role !== 'architect' && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteUser(u)}
                        title="Hapus Akun Permanen"
                        disabled={creating}
                      >
                        <ShieldOff size={14} /> Hapus
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
