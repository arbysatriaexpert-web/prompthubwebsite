import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Save, Trash2 } from 'lucide-react'
import './AdminCrud.css'

export default function AdminRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => { fetchRequests() }, [])

  async function fetchRequests() {
    setLoading(true)
    const { data } = await supabase
      .from('feedback_requests')
      .select('*, profiles(display_name), projects(title)')
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from('feedback_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (!error) fetchRequests()
  }

  async function updateNotes(id, notes) {
    await supabase.from('feedback_requests').update({ admin_notes: notes, updated_at: new Date().toISOString() }).eq('id', id)
  }

  async function handleDeleteRequest(r) {
    if (!confirm('Yakin ingin menghapus request ini permanen? File lampiran juga akan ikut terhapus.')) return

    // Hapus file dari bucket jika ada
    if (r.attachment_url && !r.attachment_url.startsWith('http')) {
      await supabase.storage.from('media').remove([r.attachment_url])
    }

    // Hapus row
    await supabase.from('feedback_requests').delete().eq('id', r.id)
    fetchRequests()
  }

  // Get signed URL for private attachment
  async function getAttachmentUrl(path) {
    if (!path) return null
    // If it's already a full URL, return it
    if (path.startsWith('http')) return path
    // Otherwise create signed URL
    const { data } = await supabase.storage.from('media').createSignedUrl(path, 3600) // 1 hour
    return data?.signedUrl || null
  }

  const filtered = requests
    .filter(r => filter === 'all' || r.status === filter)
    .filter(r => typeFilter === 'all' || r.type === typeFilter)

  const statusLabels = { pending: '🟡 Pending', 'in-progress': '🔵 In Progress', done: '🟢 Selesai' }
  const typeLabels = { request: '📩 Request', bug: '🐛 Bug', glitch: '⚡ Glitch', feedback: '💬 Feedback' }
  const typeColors = { request: 'badge-accent', bug: 'badge-red', glitch: 'badge-amber', feedback: 'badge-green' }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">📩 Request Masuk</h1>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Status</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['all', 'pending', 'in-progress', 'done'].map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'Semua' : statusLabels[f]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tipe</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['all', 'request', 'bug', 'glitch', 'feedback'].map(t => (
              <button key={t} className={`btn btn-sm ${typeFilter === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTypeFilter(t)}>
                {t === 'all' ? 'Semua' : typeLabels[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Memuat...</p> : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📩</div>
          <div className="empty-text">Tidak ada request yang cocok dengan filter.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(r => (
            <div key={r.id} className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text-white)', fontSize: '14px' }}>
                    {r.profiles?.display_name || 'User'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    {new Date(r.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {/* Type badge */}
                  {r.type && (
                    <span className={`badge ${typeColors[r.type] || 'badge-accent'}`} style={{ marginLeft: '8px', fontSize: '10px' }}>
                      {typeLabels[r.type] || r.type}
                    </span>
                  )}
                  {/* Related project */}
                  {r.projects?.title && (
                    <span style={{ fontSize: '11px', color: 'var(--accent)', marginLeft: '8px' }}>
                      📦 {r.projects.title}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    className="select"
                    style={{ width: 'auto', fontSize: '11px', padding: '4px 28px 4px 8px' }}
                    value={r.status}
                    onChange={e => updateStatus(r.id, e.target.value)}
                  >
                    <option value="pending">🟡 Pending</option>
                    <option value="in-progress">🔵 In Progress</option>
                    <option value="done">🟢 Selesai</option>
                  </select>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteRequest(r)} title="Hapus Request">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '10px', lineHeight: 1.6 }}>
                "{r.message}"
              </p>

              {r.reference_url && (
                <p style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '8px' }}>
                  🔗 <a href={r.reference_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{r.reference_url}</a>
                </p>
              )}

              {/* Attachment preview — using signed URL for private files */}
              {r.attachment_url && (
                <div style={{ marginBottom: '10px' }}>
                  {r.attachment_type === 'video' ? (
                    <AttachmentVideo path={r.attachment_url} />
                  ) : (
                    <AttachmentImage path={r.attachment_url} />
                  )}
                </div>
              )}

              {/* Legacy: media_urls from old format */}
              {r.media_urls && r.media_urls.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  {r.media_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`ref-${i}`} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
                    </a>
                  ))}
                </div>
              )}

              <div className="field-group" style={{ marginBottom: 0 }}>
                <label className="field-label">Catatan Admin</label>
                <input
                  className="input"
                  defaultValue={r.admin_notes || ''}
                  placeholder="Tulis catatan..."
                  onBlur={e => updateNotes(r.id, e.target.value)}
                  style={{ fontSize: '12px' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Sub-component for image attachment with signed URL
function AttachmentImage({ path }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (path.startsWith('http')) { setUrl(path); return }
    supabase.storage.from('media').createSignedUrl(path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl || null))
  }, [path])
  if (!url) return <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📎 Memuat lampiran...</span>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt="attachment" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
    </a>
  )
}

// Sub-component for video attachment with signed URL
function AttachmentVideo({ path }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (path.startsWith('http')) { setUrl(path); return }
    supabase.storage.from('media').createSignedUrl(path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl || null))
  }, [path])
  if (!url) return <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🎬 Memuat video...</span>
  return (
    <video src={url} controls preload="metadata" style={{ maxWidth: 300, maxHeight: 200, borderRadius: 8 }} />
  )
}
