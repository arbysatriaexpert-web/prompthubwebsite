import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Save, X, GripVertical } from 'lucide-react'
import MediaUploadField from '../../components/MediaUploadField'
import './AdminCrud.css'
import { useToast } from '../../components/Toast'

export default function AdminSlides() {
  const { toast } = useToast()
  const [slides, setSlides] = useState([])
  const [loading, setLoading] = useState(true)
  const [reordering, setReordering] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ image_url: '', tag_text: '🔥 Trending', title: '', link_to: '', is_active: true })

  // FIX: daftar tujuan link supaya admin tidak perlu mengetik path manual
  const [linkTargets, setLinkTargets] = useState([])
  const [customLink, setCustomLink] = useState(false)

  useEffect(() => { fetchSlides(); fetchLinkTargets() }, [])

  async function fetchLinkTargets() {
    const [projRes, artRes] = await Promise.all([
      supabase.from('projects').select('id, title').eq('is_published', true).order('title'),
      supabase.from('articles').select('id, title, category').eq('is_published', true).order('title'),
    ])
    const targets = [
      { value: '/tools', label: 'Halaman: Tools Prompt' },
      { value: '/info', label: 'Halaman: Info AI' },
      { value: '/tips', label: 'Halaman: Tips & Trik' },
      { value: '/akun', label: 'Halaman: Akun' },
      ...(projRes.data || []).map(p => ({ value: `/tools/${p.id}`, label: `Tool: ${p.title}` })),
      ...(artRes.data || []).map(a => ({
        value: `/artikel/${a.id}`,
        label: `${a.category === 'tips' ? 'Tips' : 'Info AI'}: ${a.title}`,
      })),
    ]
    setLinkTargets(targets)
  }

  async function fetchSlides() {
    setLoading(true)
    const { data } = await supabase.from('hero_slides').select('*').order('sort_order')
    setSlides(data || [])
    setLoading(false)
  }

  // v5.5 — upload ditangani <MediaUploadField>.
  // Versi lama di sini hanya menulis `if (!error) { ... }` tanpa cabang else,
  // jadi upload yang ditolak RLS atau kebesaran ukurannya lewat tanpa pesan
  // apa pun — inilah salah satu sebab "preview tidak muncul".

  async function handleSave() {
    if (!form.title.trim()) return toast('Judul wajib diisi.', 'error')

    // Link tanpa garis miring di depan bikin React Router diam di tempat,
    // jadi dirapikan dulu sebelum disimpan.
    let link = (form.link_to || '').trim()
    if (link && !/^(https?:\/\/|\/)/i.test(link)) link = '/' + link.replace(/^\/+/, '')
    const row = { ...form, link_to: link }

    const { error } = editingId
      ? await supabase.from('hero_slides').update(row).eq('id', editingId)
      : await supabase.from('hero_slides').insert(row)

    if (error) return toast(`Gagal menyimpan slide: ${error.message}`, 'error', 9000)
    toast(editingId ? 'Slide diperbarui' : 'Slide dibuat', 'success')
    resetForm(); fetchSlides()
  }

  async function handleDelete(id) {
    if (!confirm('Yakin hapus slide ini?')) return
    const { error } = await supabase.from('hero_slides').delete().eq('id', id)
    if (error) return toast(`Gagal menghapus slide: ${error.message}`, 'error', 6000)
    toast('Slide dihapus', 'success')
    fetchSlides()
  }

  async function handleDrop(targetIndex) {
    if (!dragId) return
    const sourceIndex = slides.findIndex(x => x.id === dragId)
    setDragId(null)
    
    if (sourceIndex === targetIndex || sourceIndex === -1) return

    setReordering(true)
    const newArr = [...slides]
    const [moved] = newArr.splice(sourceIndex, 1)
    newArr.splice(targetIndex, 0, moved)
    
    setSlides(newArr)

    const updates = []
    newArr.forEach((s, idx) => {
      const expectedOrder = idx + 1
      if (s.sort_order !== expectedOrder) {
        updates.push(supabase.from('hero_slides').update({ sort_order: expectedOrder }).eq('id', s.id))
      }
    })

    if (updates.length > 0) {
      const results = await Promise.all(updates)
      if (results.some(r => r.error)) {
        toast('Gagal menyimpan urutan baru', 'error')
        fetchSlides()
      }
    }
    setReordering(false)
  }

  function startEdit(s) {
    setEditingId(s.id)
    setForm({ image_url: s.image_url, tag_text: s.tag_text, title: s.title, link_to: s.link_to || '', is_active: s.is_active })
    setCustomLink(!!s.link_to && !linkTargets.some(t => t.value === s.link_to))
    setShowForm(true)
  }

  function resetForm() {
    setEditingId(null)
    setForm({ image_url: '', tag_text: '🔥 Trending', title: '', link_to: '', is_active: true })
    setCustomLink(false)
    setShowForm(false)
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">🖼️ Hero Slides</h1>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}><Plus size={16} /> Tambah Slide</button>
      </div>

      {showForm && (
        <div className="crud-form card">
          <h3 className="crud-form-title">{editingId ? 'Edit Slide' : 'Tambah Slide Baru'}</h3>
          <div className="field-group">
            <MediaUploadField
              label="Gambar Slide"
              value={form.image_url}
              folder="slides"
              accept="image/*,video/*"
              kind="both"
              previewHeight={170}
              onUploaded={url => setForm(prev => ({ ...prev, image_url: url }))}
              onRemove={() => setForm(prev => ({ ...prev, image_url: '' }))}
              onError={msg => toast(msg, 'error', 8000)}
              onSuccess={msg => toast(msg, 'success')}
              hint="Slide tampil di Home untuk semua pengunjung, jadi ini file yang paling sering diunduh. Pakai gambar kalau bisa."
            />
          </div>
          <div className="crud-form-grid">
            <div className="field-group">
              <label className="field-label">Tag</label>
              <input className="input" value={form.tag_text} onChange={e => setForm({...form, tag_text: e.target.value})} placeholder="🔥 Trending" />
            </div>
            <div className="field-group">
              <label className="field-label">Judul *</label>
              <input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Judul slide..." />
            </div>
            <div className="field-group">
              <label className="field-label">Link Tujuan (opsional)</label>
              {customLink ? (
                <>
                  <input className="input" value={form.link_to}
                    onChange={e => setForm({ ...form, link_to: e.target.value })}
                    placeholder="https://situs-lain.com  atau  /tools/xxxx" />
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }}
                    onClick={() => { setCustomLink(false); setForm({ ...form, link_to: '' }) }}>
                    Pilih dari daftar
                  </button>
                </>
              ) : (
                <>
                  <select className="select" value={form.link_to}
                    onChange={e => {
                      if (e.target.value === '__custom__') { setCustomLink(true); setForm({ ...form, link_to: '' }) }
                      else setForm({ ...form, link_to: e.target.value })
                    }}>
                    <option value="">— Tidak ada link —</option>
                    {linkTargets.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    <option value="__custom__">✏️ Ketik link sendiri...</option>
                  </select>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Pilih tujuan dari daftar supaya link pasti valid. Mengetik manual sering salah path sehingga slide tidak pindah halaman.
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="toggle-row">
            <div className={`toggle ${form.is_active ? 'active' : ''}`} onClick={() => setForm({...form, is_active: !form.is_active})} />
            <span className="toggle-label">Aktif</span>
          </div>
          <div className="crud-form-actions">
            <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Simpan</button>
            <button className="btn btn-ghost" onClick={resetForm}><X size={14} /> Batal</button>
          </div>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Memuat...</p> : (
        <table className="admin-table">
          <thead><tr><th style={{ width: 60 }}>Urutan</th><th>Preview</th><th>Tag</th><th>Judul</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {slides.map((s, i) => (
              <tr key={s.id}
                draggable={!reordering}
                onDragStart={() => setDragId(s.id)}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                onDrop={(e) => { e.preventDefault(); handleDrop(i) }}
                style={{
                  opacity: dragId === s.id ? 0.4 : (reordering ? 0.6 : 1),
                  cursor: reordering ? 'wait' : 'grab',
                  background: dragId === s.id ? 'var(--bg-dark)' : 'transparent',
                  transition: 'opacity 0.2s, background 0.2s'
                }}
              >
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <GripVertical size={14} color="var(--text-muted)" style={{ cursor: reordering ? 'wait' : 'grab' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 14, textAlign: 'center' }}>{i + 1}</span>
                  </div>
                </td>
                <td>
                  {s.image_url ? (
                    s.image_url.match(/\.(mp4|webm|ogg)$/i) ? (
                      <video src={s.image_url} muted preload="metadata" style={{ width: 80, height: 40, objectFit: 'cover', borderRadius: 6, background: '#000' }} />
                    ) : (
                      <img loading="lazy" decoding="async" src={s.image_url} alt="" style={{ width: 80, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                    )
                  ) : '—'}
                </td>
                <td>{s.tag_text}</td>
                <td style={{ fontWeight: 600 }}>{s.title}</td>
                <td><span className={`badge ${s.is_active ? 'badge-green' : 'badge-red'}`}>{s.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                <td>
                  <div className="actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(s)}><Pencil size={14} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}><Trash2 size={14} /></button>
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
