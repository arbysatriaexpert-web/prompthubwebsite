import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Save, X, Upload } from 'lucide-react'
import './AdminCrud.css'
import { useToast } from '../../components/Toast'

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export default function AdminCategories() {
  const { toast } = useToast()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', icon: '', sort_order: 0, slug: '', is_active: true })
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function handleUploadIcon(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `thumbnails/cat_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
      setForm(prev => ({ ...prev, icon: urlData.publicUrl }))
    } else {
      toast('Gagal upload ikon: ' + error.message, 'error')
    }
    setUploading(false)
  }

  useEffect(() => { fetchCategories() }, [])

  async function fetchCategories() {
    setLoading(true)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
    if (!error) setCategories(data || [])
    setLoading(false)
  }

  function handleNameChange(name) {
    const autoSlug = editingId ? form.slug : generateSlug(name)
    setForm({ ...form, name, slug: autoSlug })
  }

  async function handleSave() {
    if (!form.name.trim()) return

    const slug = form.slug.trim() || generateSlug(form.name)

    if (editingId) {
      await supabase.from('categories').update({
        name: form.name,
        icon: form.icon,
        sort_order: Number(form.sort_order),
        slug,
        is_active: form.is_active,
      }).eq('id', editingId)
    } else {
      await supabase.from('categories').insert({
        name: form.name,
        icon: form.icon,
        sort_order: Number(form.sort_order),
        slug,
        is_active: form.is_active,
      })
    }

    resetForm()
    fetchCategories()
  }

  async function handleDelete(id) {
    if (!confirm('Yakin hapus kategori ini?')) return
    await supabase.from('categories').delete().eq('id', id)
    fetchCategories()
  }

  async function toggleActive(cat) {
    await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    fetchCategories()
  }

  function startEdit(cat) {
    setEditingId(cat.id)
    setForm({
      name: cat.name,
      icon: cat.icon,
      sort_order: cat.sort_order,
      slug: cat.slug || generateSlug(cat.name),
      is_active: cat.is_active !== false,
    })
    setShowForm(true)
  }

  function resetForm() {
    setEditingId(null)
    setForm({ name: '', icon: '', sort_order: 0, slug: '', is_active: true })
    setShowForm(false)
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">🏷️ Kelola Kategori</h1>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
          <Plus size={16} /> Tambah Kategori
        </button>
      </div>

      {showForm && (
        <div className="crud-form card">
          <h3 className="crud-form-title">{editingId ? 'Edit Kategori' : 'Tambah Kategori Baru'}</h3>
          <div className="crud-form-grid">
            <div className="field-group">
              <label className="field-label">Ikon (Foto 1:1)</label>
              {form.icon && form.icon.startsWith('http') ? (
                <div className="upload-preview" style={{ width: 80, height: 80 }}>
                  <img src={form.icon} alt="icon" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                  <button className="remove-preview" onClick={() => setForm({...form, icon: ''})}>×</button>
                </div>
              ) : (
                <label className="upload-area" style={{ padding: '20px' }}>
                  <input type="file" accept="image/*" onChange={handleUploadIcon} />
                  <div className="upload-icon">📤</div>
                  <div className="upload-text" style={{ fontSize: '11px' }}>{uploading ? 'Mengupload...' : 'Upload foto (wajib 1:1)'}</div>
                </label>
              )}
            </div>
            <div className="field-group">
              <label className="field-label">Nama Kategori</label>
              <input className="input" value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="Video Tools" />
            </div>
            <div className="field-group">
              <label className="field-label">Slug (URL)</label>
              <input className="input" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} placeholder="video-tools" style={{ fontFamily: 'monospace', fontSize: '12px' }} />
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Auto-generate dari nama. Bisa override manual.</p>
            </div>
            <div className="field-group">
              <label className="field-label">Urutan</label>
              <input className="input" type="number" value={form.sort_order} onChange={e => setForm({...form, sort_order: e.target.value})} />
            </div>
            <div className="field-group">
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} style={{ accentColor: 'var(--accent)' }} />
                Aktif (tampil di web user)
              </label>
            </div>
          </div>
          <div className="crud-form-actions">
            <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Simpan</button>
            <button className="btn btn-ghost" onClick={resetForm}><X size={14} /> Batal</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Memuat...</p>
      ) : categories.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Belum ada kategori. Klik "Tambah Kategori" untuk mulai.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ikon</th>
              <th>Nama</th>
              <th>Slug</th>
              <th>Urutan</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat.id} style={{ opacity: cat.is_active === false ? 0.5 : 1 }}>
                <td style={{ fontSize: '22px' }}>
                  {cat.icon?.startsWith('http') ? (
                    <img src={cat.icon} alt={cat.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} />
                  ) : (
                    cat.icon || '—'
                  )}
                </td>
                <td>{cat.name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>{cat.slug || '—'}</td>
                <td>{cat.sort_order}</td>
                <td>
                  <button
                    className={`btn btn-sm ${cat.is_active !== false ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => toggleActive(cat)}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                  >
                    {cat.is_active !== false ? '✅ Aktif' : '❌ Nonaktif'}
                  </button>
                </td>
                <td>
                  <div className="actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(cat)}><Pencil size={14} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cat.id)}><Trash2 size={14} /></button>
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
