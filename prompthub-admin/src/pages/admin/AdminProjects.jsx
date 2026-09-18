import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/Toast'
import {
  Plus, Pencil, Trash2, Save, X, Eye, EyeOff,
  ClipboardList, Wrench, ExternalLink, AlertCircle,
  ArrowUp, ArrowDown, ListOrdered, Flame
} from 'lucide-react'
import './AdminCrud.css'

const EMPTY_FORM = {
  title: '',
  description: '',
  category_id: '',
  content_type: 'copy-paste',
  prompt_text: '',
  tool_url: '',
  thumbnail_url: '',
  aspect_ratio: '9:16',
  tutorial_aspect_ratio: '16:9',
  video_url: '',
  tutorial_video_url: '',
  is_published: false,
  is_featured: false,
  is_trending: false,
}

export default function AdminProjects() {
  const { toast } = useToast()
  const [projects, setProjects] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  // 'catalog'  -> urutan umum (Home rekomendasi + halaman Tools)
  // 'trending' -> urutan khusus bagian "Lagi Tren Sekarang"
  const [orderMode, setOrderMode] = useState('catalog')
  const orderField = orderMode === 'trending' ? 'trending_order' : 'sort_order'

  const isGenerator = form.content_type === 'generator'

  useEffect(() => { fetchAll() }, [orderMode])

  async function fetchAll() {
    setLoading(true)

    let query = supabase.from('projects').select('*, categories(name, icon)')
    if (orderMode === 'trending') query = query.eq('is_trending', true)
    query = query.order(orderField, { ascending: true }).order('created_at', { ascending: false })

    const [projRes, catRes] = await Promise.all([
      query,
      supabase.from('categories').select('*').order('sort_order'),
    ])

    if (projRes.error) toast(`Gagal memuat project: ${projRes.error.message}`, 'error', 6000)
    else setProjects(projRes.data || [])

    if (!catRes.error) setCategories(catRes.data || [])
    setLoading(false)
  }

  async function handleUploadThumbnail(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `thumbnails/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, file)
    if (error) {
      toast(`Gagal upload thumbnail: ${error.message}`, 'error', 6000)
    } else {
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
      setForm(prev => ({ ...prev, thumbnail_url: urlData.publicUrl }))
      toast('Thumbnail berhasil diupload', 'success')
    }
    setUploading(false)
  }

  function validate({ forPublish }) {
    const errors = []
    if (!form.title.trim()) errors.push('Judul')

    if (isGenerator) {
      if (!form.tool_url.trim()) errors.push('Tool URL (wajib untuk tipe Generator)')
      else if (!/^https?:\/\//i.test(form.tool_url.trim())) {
        errors.push('Tool URL harus diawali http:// atau https://')
      }
    } else {
      if (!form.prompt_text.trim()) errors.push('Isi Prompt (wajib untuk tipe Copy-Paste)')
    }

    if (forPublish) {
      if (!form.category_id) errors.push('Kategori')
      if (!form.thumbnail_url) errors.push('Thumbnail')
    }
    return errors
  }

  async function handleSave() {
    const errors = validate({ forPublish: form.is_published })
    if (errors.length > 0) {
      toast(`Belum bisa disimpan. Lengkapi dulu:\n• ${errors.join('\n• ')}`, 'error', 7000)
      return
    }

    setSaving(true)

    const payload = {
      title: form.title.trim(),
      description: form.description,
      category_id: form.category_id || null,
      content_type: form.content_type,
      aspect_ratio: form.aspect_ratio,
      tutorial_aspect_ratio: form.tutorial_aspect_ratio,
      thumbnail_url: form.thumbnail_url,
      video_url: form.video_url,
      tool_url: isGenerator ? form.tool_url.trim() : '',
      prompt_data: isGenerator ? {} : { prompt_text: form.prompt_text },
      tutorial_video_url: form.tutorial_video_url,
      is_published: form.is_published,
      is_featured: form.is_featured,
      is_trending: form.is_trending,
      updated_at: new Date().toISOString(),
    }

    let result
    if (editingId) {
      result = await supabase.from('projects').update(payload).eq('id', editingId)
    } else {
      // Project baru diletakkan di urutan paling bawah
      const { data: maxRow } = await supabase
        .from('projects').select('sort_order')
        .order('sort_order', { ascending: false }).limit(1).maybeSingle()
      payload.sort_order = (maxRow?.sort_order || 0) + 1
      payload.trending_order = payload.sort_order
      result = await supabase.from('projects').insert(payload)
    }

    setSaving(false)

    if (result.error) {
      const e = result.error
      const hint = e.code === '42501' || /row-level security/i.test(e.message || '')
        ? '\n\nSepertinya RLS memblokir. Jalankan supabase_patch_v5.3.sql di SQL Editor.'
        : ''
      toast(`Gagal menyimpan: ${e.message}${hint}`, 'error', 9000)
      console.error('Save error:', e)
      return
    }

    toast(editingId ? 'Project berhasil diperbarui' : 'Project baru berhasil dibuat', 'success')
    resetForm()
    fetchAll()
  }

  /** Tukar posisi dengan tetangga di atas/bawah */
  async function move(index, dir) {
    const target = index + dir
    if (target < 0 || target >= projects.length) return

    setReordering(true)
    const a = projects[index]
    const b = projects[target]

    // Nilai urutan bisa kembar/nol. Normalkan dulu berdasarkan posisi tampil.
    const valA = a[orderField] ?? 0
    const valB = b[orderField] ?? 0
    const newA = valA === valB ? target + 1 : valB
    const newB = valA === valB ? index + 1 : valA

    // Optimistic: geser di layar dulu supaya terasa instan
    const next = [...projects]
    next[index] = b
    next[target] = a
    setProjects(next)

    const [r1, r2] = await Promise.all([
      supabase.from('projects').update({ [orderField]: newA }).eq('id', a.id),
      supabase.from('projects').update({ [orderField]: newB }).eq('id', b.id),
    ])

    setReordering(false)

    if (r1.error || r2.error) {
      toast(`Gagal mengubah urutan: ${(r1.error || r2.error).message}`, 'error', 6000)
      fetchAll()
    }
  }

  /** Rapikan ulang jadi 1,2,3,... supaya urutan stabil */
  async function normalizeOrder() {
    setReordering(true)
    const updates = projects.map((p, i) =>
      supabase.from('projects').update({ [orderField]: i + 1 }).eq('id', p.id)
    )
    const results = await Promise.all(updates)
    setReordering(false)
    const failed = results.find(r => r.error)
    if (failed) return toast(`Gagal merapikan urutan: ${failed.error.message}`, 'error', 6000)
    toast('Urutan dirapikan', 'success')
    fetchAll()
  }

  async function handleDelete(id) {
    if (!confirm('Yakin hapus project ini?')) return
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) return toast(`Gagal menghapus: ${error.message}`, 'error', 6000)
    toast('Project dihapus', 'success')
    fetchAll()
  }

  async function togglePublish(proj) {
    if (!proj.is_published) {
      const missing = []
      if (!proj.category_id) missing.push('Kategori')
      if (!proj.thumbnail_url) missing.push('Thumbnail')
      if (proj.content_type === 'generator' && !proj.tool_url) missing.push('Tool URL')
      if (proj.content_type !== 'generator' && !proj.prompt_data?.prompt_text) missing.push('Isi Prompt')
      if (missing.length) {
        return toast(`Tidak bisa publish. Lengkapi dulu: ${missing.join(', ')}`, 'error', 6000)
      }
    }

    const { error } = await supabase
      .from('projects')
      .update({ is_published: !proj.is_published, updated_at: new Date().toISOString() })
      .eq('id', proj.id)

    if (error) return toast(`Gagal mengubah status: ${error.message}`, 'error', 6000)
    toast(proj.is_published ? 'Project di-unpublish' : 'Project dipublish', 'success')
    fetchAll()
  }

  async function quickToggle(proj, field) {
    const { error } = await supabase
      .from('projects')
      .update({ [field]: !proj[field], updated_at: new Date().toISOString() })
      .eq('id', proj.id)
    if (error) return toast(`Gagal update: ${error.message}`, 'error', 6000)
    fetchAll()
  }

  function startEdit(proj) {
    setEditingId(proj.id)
    setForm({
      title: proj.title || '',
      description: proj.description || '',
      category_id: proj.category_id || '',
      content_type: proj.content_type === 'generator' ? 'generator' : 'copy-paste',
      prompt_text: proj.prompt_data?.prompt_text || proj.prompt_text || '',
      tool_url: proj.tool_url || '',
      thumbnail_url: proj.thumbnail_url || '',
      aspect_ratio: proj.aspect_ratio || '9:16',
      tutorial_aspect_ratio: proj.tutorial_aspect_ratio || '16:9',
      video_url: proj.video_url || '',
      tutorial_video_url: proj.tutorial_video_url || '',
      is_published: !!proj.is_published,
      is_featured: !!proj.is_featured,
      is_trending: !!proj.is_trending,
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  function sourceCell(p) {
    if (p.content_type === 'generator') {
      return p.tool_url
        ? <a href={p.tool_url} target="_blank" rel="noopener noreferrer"
             style={{ color: 'var(--accent, #818cf8)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ExternalLink size={11} /> Tool URL
          </a>
        : <span style={{ color: '#f87171', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={11} /> Tool URL kosong
          </span>
    }
    const txt = p.prompt_data?.prompt_text || p.prompt_text || ''
    return txt
      ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{txt.length} karakter</span>
      : <span style={{ color: '#f87171', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <AlertCircle size={11} /> Prompt kosong
        </span>
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">📦 Kelola Project</h1>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }}>
          <Plus size={16} /> Tambah Project
        </button>
      </div>

      {showForm && (
        <div className="crud-form card">
          <h3 className="crud-form-title">{editingId ? 'Edit Project' : 'Tambah Project Baru'}</h3>

          {/* 1. INFO DASAR */}
          <div className="crud-form-row">
            <div className="field-group">
              <label className="field-label">Judul *</label>
              <input className="input" value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="UGC Video Outfit Review" />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Deskripsi</label>
            <textarea className="textarea" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Deskripsi singkat project ini..." rows={2} />
          </div>

          <div className="field-group">
            <label className="field-label">Kategori</label>
            <select className="select" value={form.category_id}
              onChange={e => setForm({ ...form, category_id: e.target.value })}>
              <option value="">— Pilih Kategori —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.icon?.startsWith('http') ? '🖼️' : (c.icon || '📁')} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. TIPE KONTEN */}
          <div className="field-group">
            <label className="field-label">Tipe Konten *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {[
                { v: 'copy-paste', icon: ClipboardList, t: 'Copy-Paste', d: 'User menyalin teks prompt langsung dari halaman detail.' },
                { v: 'generator', icon: Wrench, t: 'Generator', d: 'User diarahkan ke tool HTML mandiri (GitHub Pages).' },
              ].map(opt => {
                const active = form.content_type === opt.v
                return (
                  <button key={opt.v} type="button"
                    onClick={() => setForm({ ...form, content_type: opt.v })}
                    style={{
                      textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                      background: active ? 'rgba(99,102,241,0.14)' : 'var(--bg-dark, #14141f)',
                      border: active ? '2px solid rgba(99,102,241,0.85)' : '1px solid rgba(255,255,255,0.08)',
                      color: active ? 'var(--accent, #a5b4fc)' : 'var(--text-muted, #9ca3af)',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13 }}>
                      <opt.icon size={15} /> {opt.t}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4, lineHeight: 1.4 }}>{opt.d}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3. ISI KONTEN */}
          {isGenerator ? (
            <div className="field-group">
              <label className="field-label">Tool URL * (link GitHub Pages)</label>
              <input className="input" value={form.tool_url}
                onChange={e => setForm({ ...form, tool_url: e.target.value })}
                placeholder="https://satria-architect.github.io/suki/tools/ugc-v4.html" />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Halaman detail menampilkan tombol <strong>“Buka Generator”</strong> ke URL ini.
              </p>
              {form.tool_url && /^https?:\/\//i.test(form.tool_url) && (
                <a href={form.tool_url} target="_blank" rel="noopener noreferrer"
                   style={{ fontSize: 11, color: 'var(--accent, #818cf8)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <ExternalLink size={11} /> Tes buka link ini
                </a>
              )}
            </div>
          ) : (
            <div className="field-group">
              <label className="field-label">Isi Prompt * (teks yang disalin user)</label>
              <textarea className="textarea" rows={8} value={form.prompt_text}
                onChange={e => setForm({ ...form, prompt_text: e.target.value })}
                placeholder={'Tempel teks prompt lengkap di sini.\nUser akan melihat teks ini dan menekan tombol "Salin Prompt".'}
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: 1.6 }} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {form.prompt_text.length} karakter — disimpan ke <code>prompt_data.prompt_text</code>.
              </p>
            </div>
          )}

          {/* 4. MEDIA */}
          <div className="crud-form-row">
            <div className="field-group">
              <label className="field-label">Thumbnail</label>
              {form.thumbnail_url ? (
                <div className="upload-preview">
                  {form.thumbnail_url.match(/\.(mp4|webm|ogg)$/i) ? (
                    <video src={form.thumbnail_url} controls style={{ width: '100%', borderRadius: 8 }} />
                  ) : (
                    <img src={form.thumbnail_url} alt="thumb" style={{ width: '100%', borderRadius: 8 }} />
                  )}
                  <button className="remove-preview" onClick={() => setForm({ ...form, thumbnail_url: '' })}>×</button>
                </div>
              ) : (
                <label className="upload-area">
                  <input type="file" accept="image/*,video/*" onChange={handleUploadThumbnail} />
                  <div className="upload-icon">📤</div>
                  <div className="upload-text">{uploading ? 'Mengupload...' : 'Klik untuk upload gambar atau video'}</div>
                </label>
              )}
            </div>

            <div className="field-group">
              <label className="field-label">Rasio Kartu (tampilan thumbnail di web)</label>
              <select className="select" value={form.aspect_ratio}
                onChange={e => setForm({ ...form, aspect_ratio: e.target.value })}>
                <option value="9:16">9:16 — Potret (Tiktok/Reels)</option>
                <option value="16:9">16:9 — Lanskap (YouTube)</option>
                <option value="1:1">1:1 — Kotak</option>
              </select>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Hanya bentuk kartu di Home/Tools.
              </p>

              <label className="field-label" style={{ marginTop: 14, display: 'block' }}>Video Showcase URL (opsional)</label>
              <input className="input" value={form.video_url}
                onChange={e => setForm({ ...form, video_url: e.target.value })}
                placeholder="https://youtube.com/watch?v=..." />
            </div>
          </div>

          {/* 5. TUTORIAL + FRAME-nya (FIX: dulu ikut rasio kartu) */}
          <div className="crud-form-row">
            <div className="field-group">
              <label className="field-label">🎬 Tutorial Video URL (opsional)</label>
              <input className="input" value={form.tutorial_video_url}
                onChange={e => setForm({ ...form, tutorial_video_url: e.target.value })}
                placeholder="https://youtu.be/xxxxxxxx" />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Mendukung youtu.be, watch?v=, /shorts/, /embed/, atau link video langsung (.mp4).
              </p>
            </div>

            <div className="field-group">
              <label className="field-label">Frame Video Tutorial</label>
              <select className="select" value={form.tutorial_aspect_ratio}
                onChange={e => setForm({ ...form, tutorial_aspect_ratio: e.target.value })}>
                <option value="16:9">16:9 — Lanskap (video YouTube biasa)</option>
                <option value="9:16">9:16 — Potret (Shorts/Reels)</option>
                <option value="1:1">1:1 — Kotak</option>
              </select>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Terpisah dari rasio kartu. Pilih sesuai bentuk asli videonya supaya tidak gepeng di web user.
              </p>
            </div>
          </div>

          {/* 6. STATUS */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
            <div className="toggle-row">
              <div className={`toggle ${form.is_published ? 'active' : ''}`}
                onClick={() => setForm({ ...form, is_published: !form.is_published })} />
              <span className="toggle-label">Published</span>
            </div>
            <div className="toggle-row">
              <div className={`toggle ${form.is_featured ? 'active' : ''}`}
                onClick={() => setForm({ ...form, is_featured: !form.is_featured })} />
              <span className="toggle-label">Featured (Rekomendasi Home)</span>
            </div>
            <div className="toggle-row">
              <div className={`toggle ${form.is_trending ? 'active' : ''}`}
                onClick={() => setForm({ ...form, is_trending: !form.is_trending })} />
              <span className="toggle-label">Trending (Galeri Home)</span>
            </div>
          </div>

          <div className="crud-form-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : <><Save size={14} /> Simpan</>}
            </button>
            <button className="btn btn-ghost" onClick={resetForm}><X size={14} /> Batal</button>
          </div>
        </div>
      )}

      {/* ── PENGATUR URUTAN ── */}
      <div className="card" style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '10px 14px', marginBottom: 14,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Atur urutan:</span>

        {[
          { v: 'catalog', icon: ListOrdered, t: 'Urutan Katalog' },
          { v: 'trending', icon: Flame, t: 'Urutan Trending' },
        ].map(m => {
          const active = orderMode === m.v
          return (
            <button key={m.v} type="button" onClick={() => setOrderMode(m.v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
                border: active ? '1px solid rgba(99,102,241,0.7)' : '1px solid rgba(255,255,255,0.1)',
                color: active ? 'var(--accent, #a5b4fc)' : 'var(--text-muted, #9ca3af)',
              }}>
              <m.icon size={13} /> {m.t}
            </button>
          )
        })}

        <button className="btn btn-ghost btn-sm" onClick={normalizeOrder} disabled={reordering || projects.length === 0}
          style={{ marginLeft: 'auto' }}>
          Rapikan Nomor
        </button>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 12px' }}>
        {orderMode === 'trending'
          ? 'Menampilkan project bertanda Trending saja. Urutan di sini dipakai bagian “Lagi Tren Sekarang” di Home.'
          : 'Urutan di sini dipakai bagian “Rekomendasi Pilihan” di Home dan halaman Tools Prompt.'}
      </p>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Memuat...</p>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <div className="empty-text">
            {orderMode === 'trending'
              ? 'Belum ada project bertanda Trending.'
              : 'Belum ada project. Klik “Tambah Project” untuk mulai.'}
          </div>
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>Urutan</th>
              <th>Thumb</th>
              <th>Judul</th>
              <th>Kategori</th>
              <th>Tipe</th>
              <th>Sumber Konten</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p, i) => (
              <tr key={p.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 18 }}>{i + 1}</span>
                    <button className="btn btn-ghost btn-sm" title="Naikkan"
                      disabled={i === 0 || reordering} onClick={() => move(i, -1)}
                      style={{ padding: 4, opacity: i === 0 ? 0.25 : 1 }}>
                      <ArrowUp size={13} />
                    </button>
                    <button className="btn btn-ghost btn-sm" title="Turunkan"
                      disabled={i === projects.length - 1 || reordering} onClick={() => move(i, 1)}
                      style={{ padding: 4, opacity: i === projects.length - 1 ? 0.25 : 1 }}>
                      <ArrowDown size={13} />
                    </button>
                  </div>
                </td>
                <td>
                  {p.thumbnail_url ? (
                    p.thumbnail_url.match(/\.(mp4|webm|ogg)$/i) ? (
                      <video src={p.thumbnail_url} muted style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                    ) : (
                      <img src={p.thumbnail_url} alt="" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                    )
                  ) : (
                    <div style={{ width: 48, height: 36, background: 'var(--bg-dark)', borderRadius: 6 }} />
                  )}
                </td>
                <td style={{ fontWeight: 600 }}>{p.title}</td>
                <td>{p.categories ? p.categories.name : '—'}</td>
                <td>
                  <span className="badge badge-accent">
                    {p.content_type === 'generator' ? 'Generator' : 'Prompt'}
                  </span>
                </td>
                <td>{sourceCell(p)}</td>
                <td>
                  <span className={`badge ${p.is_published ? 'badge-green' : 'badge-red'}`}>
                    {p.is_published ? 'Published' : 'Draft'}
                  </span>
                  <button className="badge badge-amber" title="Toggle Featured"
                    onClick={() => quickToggle(p, 'is_featured')}
                    style={{ marginLeft: 4, cursor: 'pointer', border: 'none', opacity: p.is_featured ? 1 : 0.3 }}>⭐</button>
                  <button className="badge badge-accent" title="Toggle Trending"
                    onClick={() => quickToggle(p, 'is_trending')}
                    style={{ marginLeft: 4, cursor: 'pointer', border: 'none', opacity: p.is_trending ? 1 : 0.3 }}>🔥</button>
                </td>
                <td>
                  <div className="actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => togglePublish(p)}
                      title={p.is_published ? 'Unpublish' : 'Publish'}>
                      {p.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}><Pencil size={14} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
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
