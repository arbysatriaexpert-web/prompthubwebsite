import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Save, X, Upload, GripVertical } from 'lucide-react'
import MediaUploadField from '../../components/MediaUploadField'
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
  const [form, setForm] = useState({ name: '', icon: '', slug: '', is_active: true })
  const [showForm, setShowForm] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [dragId, setDragId] = useState(null)

  // v5.5 — upload ditangani <MediaUploadField>.

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
        slug,
        is_active: form.is_active,
      }).eq('id', editingId)
    } else {
      await supabase.from('categories').insert({
        name: form.name,
        icon: form.icon,
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

  async function handleDrop(targetIndex) {
    if (!dragId) return
    const sourceIndex = categories.findIndex(x => x.id === dragId)
    setDragId(null)
    
    if (sourceIndex === targetIndex || sourceIndex === -1) return

    setReordering(true)
    const newArr = [...categories]
    const [moved] = newArr.splice(sourceIndex, 1)
    newArr.splice(targetIndex, 0, moved)
    
    setCategories(newArr)

    const updates = []
    newArr.forEach((cat, idx) => {
      const expectedOrder = idx + 1
      if (cat.sort_order !== expectedOrder) {
        updates.push(supabase.from('categories').update({ sort_order: expectedOrder }).eq('id', cat.id))
      }
    })

    if (updates.length > 0) {
      const results = await Promise.all(updates)
      if (results.some(r => r.error)) {
        toast('Gagal menyimpan urutan baru', 'error')
        fetchCategories()
      }
    }
    setReordering(false)
  }

  function startEdit(cat) {
    setEditingId(cat.id)
    setForm({
      name: cat.name,
      icon: cat.icon,
      slug: cat.slug || generateSlug(cat.name),
      is_active: cat.is_active !== false,
    })
    setShowForm(true)
  }

  function resetForm() {
    setEditingId(null)
    setForm({ name: '', icon: '', slug: '', is_active: true })
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
              <MediaUploadField
                label="Ikon (Foto 1:1)"
                value={form.icon && form.icon.startsWith('http') ? form.icon : ''}
                folder="thumbnails"
                prefix="cat_"
                accept="image/*"
                kind="image"
                previewHeight={90}
                maxWidth={512}
                onUploaded={url => setForm(prev => ({ ...prev, icon: url }))}
                onRemove={() => setForm(prev => ({ ...prev, icon: '' }))}
                onError={msg => toast(msg, 'error', 8000)}
                onSuccess={msg => toast(msg, 'success')}
                hint="Ikon ditampilkan kecil, jadi dikecilkan ke maksimal 512 px. Boleh juga dikosongkan dan diisi emoji di kolom mana pun yang tersedia."
              />
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
              <th style={{ width: 60 }}>Urutan</th>
              <th>Ikon</th>
              <th>Nama</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, i) => (
              <tr key={cat.id}
                draggable={!reordering}
                onDragStart={() => setDragId(cat.id)}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                onDrop={(e) => { e.preventDefault(); handleDrop(i) }}
                style={{
                  opacity: (cat.is_active === false) ? (dragId === cat.id ? 0.2 : 0.5) : (dragId === cat.id ? 0.4 : (reordering ? 0.6 : 1)),
                  cursor: reordering ? 'wait' : 'grab',
                  background: dragId === cat.id ? 'var(--bg-dark)' : 'transparent',
                  transition: 'opacity 0.2s, background 0.2s'
                }}
              >
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <GripVertical size={14} color="var(--text-muted)" style={{ cursor: reordering ? 'wait' : 'grab' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 14, textAlign: 'center' }}>{i + 1}</span>
                  </div>
                </td>
                <td style={{ fontSize: '22px' }}>
                  {cat.icon?.startsWith('http') ? (
                    <img loading="lazy" decoding="async" src={cat.icon} alt={cat.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} />
                  ) : (
                    cat.icon || '—'
                  )}
                </td>
                <td>{cat.name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>{cat.slug || '—'}</td>
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
