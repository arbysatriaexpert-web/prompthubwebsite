import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react'
import './AdminCrud.css'
import { useToast } from '../../components/Toast'

export default function AdminArticles() {
  const { toast } = useToast()
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [tab, setTab] = useState('all') // all, info-ai, tips
  const [form, setForm] = useState({
    title: '', content: '', category: 'info-ai', thumbnail_url: '', is_published: false,
    external_url: '', external_button_label: 'Kunjungi Website',
  })

  useEffect(() => { fetchArticles() }, [])

  async function fetchArticles() {
    setLoading(true)
    const { data, error } = await supabase.from('articles').select('*').order('created_at', { ascending: false })
    if (error) toast(`Gagal memuat artikel: ${error.message}`, 'error', 6000)
    else setArticles(data || [])
    setLoading(false)
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `articles/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, file)
    if (error) {
      toast(`Gagal upload gambar: ${error.message}`, 'error', 6000)
    } else {
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
      setForm(prev => ({ ...prev, thumbnail_url: urlData.publicUrl }))
      toast('Gambar berhasil diupload', 'success')
    }
    setUploading(false)
  }

  /**
   * FIX v5.4: dulu hasil update/insert tidak pernah diperiksa. Kalau RLS
   * menolak atau ada kolom yang belum dibuat, form tetap tertutup seolah-olah
   * berhasil padahal database tidak berubah — inilah sumber "sudah disimpan
   * di panel tapi tidak muncul di web user".
   */
  async function handleSave() {
    if (!form.title.trim()) return toast('Judul wajib diisi.', 'error')

    const link = form.external_url.trim()
    if (link && !/^https?:\/\//i.test(link)) {
      return toast('Link sumber harus diawali http:// atau https://', 'error', 6000)
    }
    if (form.is_published && !form.thumbnail_url) {
      return toast('Thumbnail wajib diisi sebelum artikel dipublish.', 'error', 6000)
    }

    const payload = { ...form, external_url: link, updated_at: new Date().toISOString() }

    const { error } = editingId
      ? await supabase.from('articles').update(payload).eq('id', editingId)
      : await supabase.from('articles').insert(payload)

    if (error) {
      const hint = error.code === '42501' || /row-level security/i.test(error.message || '')
        ? '\n\nSepertinya diblokir RLS. Jalankan supabase_patch_v5.4.sql di SQL Editor.'
        : /column .* does not exist/i.test(error.message || '')
          ? '\n\nAda kolom yang belum dibuat. Jalankan supabase_patch_v5.4.sql di SQL Editor.'
          : ''
      toast(`Gagal menyimpan: ${error.message}${hint}`, 'error', 9000)
      return
    }

    toast(editingId ? 'Artikel diperbarui' : 'Artikel dibuat', 'success')
    resetForm()
    fetchArticles()
  }

  async function handleDelete(id) {
    if (!confirm('Yakin hapus artikel ini?')) return
    const { error } = await supabase.from('articles').delete().eq('id', id)
    if (error) return toast(`Gagal menghapus: ${error.message}`, 'error', 6000)
    toast('Artikel dihapus', 'success')
    fetchArticles()
  }

  function startEdit(a) {
    setEditingId(a.id)
    setForm({
      title: a.title,
      content: a.content || '',
      category: a.category,
      thumbnail_url: a.thumbnail_url || '',
      is_published: a.is_published,
      external_url: a.external_url || '',
      external_button_label: a.external_button_label || 'Kunjungi Website',
    })
    setShowForm(true)
  }

  function resetForm() {
    setEditingId(null)
    setForm({
      title: '', content: '', category: 'info-ai', thumbnail_url: '', is_published: false,
      external_url: '', external_button_label: 'Kunjungi Website',
    })
    setShowForm(false)
  }

  const filtered = tab === 'all' ? articles : articles.filter(a => a.category === tab)

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">📝 Kelola Artikel</h1>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
          <Plus size={16} /> Tambah Artikel
        </button>
      </div>

      {/* Tab Filter */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {[
          { key: 'all', label: '📋 Semua' },
          { key: 'info-ai', label: '📰 Info AI' },
          { key: 'tips', label: '💡 Tips & Hack AI' },
        ].map(t => (
          <button
            key={t.key}
            className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label} ({t.key === 'all' ? articles.length : articles.filter(a => a.category === t.key).length})
          </button>
        ))}
      </div>

      {showForm && (
        <div className="crud-form card">
          <h3 className="crud-form-title">{editingId ? 'Edit Artikel' : 'Tambah Artikel Baru'}</h3>
          <div className="crud-form-grid">
            <div className="field-group">
              <label className="field-label">Judul *</label>
              <input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Judul artikel..." />
            </div>
            <div className="field-group">
              <label className="field-label">Kategori</label>
              <select className="select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                <option value="info-ai">📰 Info AI</option>
                <option value="tips">💡 Tips & Hack AI</option>
              </select>
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Isi Artikel</label>
            <textarea className="textarea" value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={10} placeholder="Tulis isi artikel di sini..." />
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
              Kalimat pertama otomatis dipakai sebagai deskripsi singkat di kartu web user, jadi tulis
              pembuka yang menjelaskan isi. Format yang dikenali: <code>#</code> judul, <code>-</code> daftar,
              <code>**tebal**</code>, <code>*miring*</code>, <code>&gt;</code> kutipan, dan <code>[teks](https://link)</code>.
            </p>
          </div>

          {/* External URL — terutama untuk Tips */}
          <div className="crud-form-grid">
            <div className="field-group">
              <label className="field-label">Link Sumber (opsional)</label>
              <input className="input" value={form.external_url} onChange={e => setForm({...form, external_url: e.target.value})} placeholder="https://example.com/artikel-asli" />
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.5 }}>
                Mulai v5.4, kartu di web user selalu membuka halaman artikel dulu. Link ini muncul
                sebagai tombol di bagian paling bawah halaman tersebut.
              </p>
            </div>
            <div className="field-group">
              <label className="field-label">Label Tombol</label>
              <input className="input" value={form.external_button_label} onChange={e => setForm({...form, external_button_label: e.target.value})} placeholder="Kunjungi Website" />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Thumbnail</label>
            {form.thumbnail_url ? (
              <div className="upload-preview">
                <img src={form.thumbnail_url} alt="thumb" />
                <button className="remove-preview" onClick={() => setForm({...form, thumbnail_url: ''})}>×</button>
              </div>
            ) : (
              <label className="upload-area">
                <input type="file" accept="image/*" onChange={handleUpload} />
                <div className="upload-icon">📤</div>
                <div className="upload-text">{uploading ? 'Mengupload...' : 'Klik untuk upload gambar'}</div>
              </label>
            )}
          </div>
          <div className="toggle-row">
            <div className={`toggle ${form.is_published ? 'active' : ''}`} onClick={() => setForm({...form, is_published: !form.is_published})} />
            <span className="toggle-label">Published</span>
          </div>
          <div className="crud-form-actions">
            <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Simpan</button>
            <button className="btn btn-ghost" onClick={resetForm}><X size={14} /> Batal</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Memuat...</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>Judul</th><th>Kategori</th><th>Link</th><th>Status</th><th>Tanggal</th><th>Aksi</th></tr></thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>{a.title}</td>
                <td><span className="badge badge-accent">{a.category === 'info-ai' ? '📰 Info AI' : '💡 Tips'}</span></td>
                <td>
                  {a.external_url ? (
                    <a href={a.external_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--accent)' }}>🔗 Link</a>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>
                <td><span className={`badge ${a.is_published ? 'badge-green' : 'badge-red'}`}>{a.is_published ? 'Published' : 'Draft'}</span></td>
                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(a.created_at).toLocaleDateString('id-ID')}</td>
                <td>
                  <div className="actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(a)}><Pencil size={14} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.id)}><Trash2 size={14} /></button>
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
