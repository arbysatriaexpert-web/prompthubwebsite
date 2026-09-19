import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Save, X, GripVertical } from 'lucide-react'
import MediaUploadField from '../../components/MediaUploadField'
import './AdminCrud.css'
import { useToast } from '../../components/Toast'

export default function AdminPopupBanners() {
  const { toast } = useToast()
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    title: '', message: '', image_url: '', link_url: '',
    button_label: 'Lihat Selengkapnya', is_active: true,
    show_after_login: true, display_mode: 'daily', start_at: '', end_at: '',
  })
  const [reordering, setReordering] = useState(false)
  const [dragId, setDragId] = useState(null)

  useEffect(() => { fetchBanners() }, [])

  async function fetchBanners() {
    setLoading(true)
    const { data, error } = await supabase
      .from('popup_banners')
      .select('*')
      .order('sort_order', { ascending: true })
    if (!error) setBanners(data || [])
    setLoading(false)
  }

  // v5.5 — upload ditangani <MediaUploadField>. Versi lama tidak punya
  // cabang else, jadi upload gagal tidak pernah terlihat.

  async function handleSave() {
    if (!form.title.trim()) return toast('Judul wajib diisi!', 'error')

    const payload = {
      title: form.title,
      message: form.message,
      image_url: form.image_url,
      link_url: form.link_url,
      button_label: form.button_label || 'Lihat Selengkapnya',
      is_active: form.is_active,
      show_after_login: form.show_after_login,
      display_mode: form.display_mode,
      start_at: form.start_at || null,
      end_at: form.end_at || null,
      updated_at: new Date().toISOString(),
    }

    if (editingId) {
      await supabase.from('popup_banners').update(payload).eq('id', editingId)
    } else {
      await supabase.from('popup_banners').insert(payload)
    }

    resetForm()
    fetchBanners()
  }

  async function handleDelete(id) {
    if (!confirm('Yakin hapus popup banner ini?')) return
    await supabase.from('popup_banners').delete().eq('id', id)
    fetchBanners()
  }

  async function toggleActive(banner) {
    await supabase.from('popup_banners').update({ is_active: !banner.is_active }).eq('id', banner.id)
    fetchBanners()
  }

  async function handleDrop(targetIndex) {
    if (!dragId) return
    const sourceIndex = banners.findIndex(x => x.id === dragId)
    setDragId(null)
    
    if (sourceIndex === targetIndex || sourceIndex === -1) return

    setReordering(true)
    const newArr = [...banners]
    const [moved] = newArr.splice(sourceIndex, 1)
    newArr.splice(targetIndex, 0, moved)
    
    setBanners(newArr)

    const updates = []
    newArr.forEach((b, idx) => {
      const expectedOrder = idx + 1
      if (b.sort_order !== expectedOrder) {
        updates.push(supabase.from('popup_banners').update({ sort_order: expectedOrder }).eq('id', b.id))
      }
    })

    if (updates.length > 0) {
      const results = await Promise.all(updates)
      if (results.some(r => r.error)) {
        toast('Gagal menyimpan urutan baru', 'error')
        fetchBanners()
      }
    }
    setReordering(false)
  }

  function startEdit(b) {
    setEditingId(b.id)
    setForm({
      title: b.title,
      message: b.message || '',
      image_url: b.image_url || '',
      link_url: b.link_url || '',
      button_label: b.button_label || 'Lihat Selengkapnya',
      is_active: b.is_active,
      show_after_login: b.show_after_login !== false,
      display_mode: b.display_mode || 'daily',
      start_at: b.start_at ? b.start_at.slice(0, 16) : '',
      end_at: b.end_at ? b.end_at.slice(0, 16) : '',
    })
    setShowForm(true)
  }

  function resetForm() {
    setEditingId(null)
    setForm({
      title: '', message: '', image_url: '', link_url: '',
      button_label: 'Lihat Selengkapnya', is_active: true,
      show_after_login: true, display_mode: 'daily', start_at: '', end_at: '',
    })
    setShowForm(false)
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">🎯 Popup Banner</h1>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
          <Plus size={16} /> Tambah Banner
        </button>
      </div>

      {showForm && (
        <div className="crud-form card">
          <h3 className="crud-form-title">{editingId ? 'Edit Banner' : 'Tambah Banner Baru'}</h3>
          <div className="crud-form-grid">
            <div className="field-group">
              <label className="field-label">Judul *</label>
              <input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Promo Spesial!" />
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Pesan</label>
            <textarea className="textarea" value={form.message} onChange={e => setForm({...form, message: e.target.value})} rows={3} placeholder="Deskripsi singkat banner..." />
          </div>
          <div className="crud-form-grid">
            <div className="field-group">
              <label className="field-label">Link URL (opsional)</label>
              <input className="input" value={form.link_url} onChange={e => setForm({...form, link_url: e.target.value})} placeholder="https://example.com" />
            </div>
            <div className="field-group">
              <label className="field-label">Label Tombol</label>
              <input className="input" value={form.button_label} onChange={e => setForm({...form, button_label: e.target.value})} placeholder="Lihat Selengkapnya" />
            </div>
          </div>
          <div className="crud-form-grid">
            <div className="field-group">
              <label className="field-label">Mulai Tampil (opsional)</label>
              <input className="input" type="datetime-local" value={form.start_at} onChange={e => setForm({...form, start_at: e.target.value})} />
            </div>
            <div className="field-group">
              <label className="field-label">Berhenti Tampil (opsional)</label>
              <input className="input" type="datetime-local" value={form.end_at} onChange={e => setForm({...form, end_at: e.target.value})} />
            </div>
          </div>
          <div className="field-group">
            <MediaUploadField
              label="Gambar Banner"
              value={form.image_url}
              folder="popup-banners"
              accept="image/*"
              kind="image"
              previewHeight={150}
              onUploaded={url => setForm(prev => ({ ...prev, image_url: url }))}
              onRemove={() => setForm(prev => ({ ...prev, image_url: '' }))}
              onError={msg => toast(msg, 'error', 8000)}
              onSuccess={msg => toast(msg, 'success')}
              hint="Banner muncul di layar setiap user yang login, jadi pilih gambar yang ringan."
            />
          </div>
          {/* FIX: pilihan seberapa sering popup muncul */}
          <div className="field-group">
            <label className="field-label">Frekuensi Tampil</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
              {[
                { v: 'once', t: 'Sekali saja', d: 'Muncul sekali per akun. Setelah ditutup tidak muncul lagi selamanya.' },
                { v: 'every_login', t: 'Setiap login', d: 'Muncul lagi tiap kali user membuka sesi baru / login ulang.' },
                { v: 'daily', t: 'Sekali per hari', d: 'Muncul maksimal satu kali dalam sehari.' },
              ].map(opt => {
                const active = form.display_mode === opt.v
                return (
                  <button key={opt.v} type="button"
                    onClick={() => setForm({ ...form, display_mode: opt.v })}
                    style={{
                      textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      background: active ? 'rgba(99,102,241,0.14)' : 'var(--bg-dark, #14141f)',
                      border: active ? '2px solid rgba(99,102,241,0.85)' : '1px solid rgba(255,255,255,0.08)',
                      color: active ? 'var(--accent, #a5b4fc)' : 'var(--text-muted, #9ca3af)',
                    }}>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{opt.t}</div>
                    <div style={{ fontSize: 11, opacity: 0.75, marginTop: 3, lineHeight: 1.4 }}>{opt.d}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="toggle-row">
              <div className={`toggle ${form.is_active ? 'active' : ''}`} onClick={() => setForm({...form, is_active: !form.is_active})} />
              <span className="toggle-label">Aktif</span>
            </div>
            <div className="toggle-row">
              <div className={`toggle ${form.show_after_login ? 'active' : ''}`} onClick={() => setForm({...form, show_after_login: !form.show_after_login})} />
              <span className="toggle-label">Tampil setelah login</span>
            </div>
          </div>
          <div className="crud-form-actions">
            <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Simpan</button>
            <button className="btn btn-ghost" onClick={resetForm}><X size={14} /> Batal</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Memuat...</p>
      ) : banners.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <div className="empty-text">Belum ada popup banner.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {banners.map((b, i) => (
            <div key={b.id} className="card"
              draggable={!reordering}
              onDragStart={() => setDragId(b.id)}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={(e) => { e.preventDefault(); handleDrop(i) }}
              style={{
                padding: '14px', 
                opacity: b.is_active ? (dragId === b.id ? 0.4 : (reordering ? 0.6 : 1)) : (dragId === b.id ? 0.2 : 0.5),
                cursor: reordering ? 'wait' : 'grab',
                background: dragId === b.id ? 'var(--bg-dark)' : 'var(--bg-card)',
                transition: 'opacity 0.2s, background 0.2s'
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ marginTop: '4px' }}>
                  <GripVertical size={16} color="var(--text-muted)" style={{ cursor: reordering ? 'wait' : 'grab' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>#{i + 1}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-white)', fontSize: '14px' }}>{b.title}</span>
                    <span className={`badge ${b.is_active ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '10px' }}>
                      {b.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  {b.message && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{b.message}</p>}
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {b.start_at && `Mulai: ${new Date(b.start_at).toLocaleDateString('id-ID')} `}
                    {b.end_at && `• Sampai: ${new Date(b.end_at).toLocaleDateString('id-ID')}`}
                    {!b.start_at && !b.end_at && 'Tanpa batas waktu'}
                  </div>
                </div>
                {b.image_url && (
                  <img loading="lazy" decoding="async" src={b.image_url} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', marginLeft: 12 }} />
                )}
              </div>
              <div className="actions" style={{ marginTop: '10px' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(b)}>
                  {b.is_active ? '❌ Nonaktifkan' : '✅ Aktifkan'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(b)}><Pencil size={14} /> Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(b.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
