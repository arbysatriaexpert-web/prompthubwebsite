import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { LogOut, Send, Bookmark, Clock, UploadCloud, X } from 'lucide-react'
import { CardMedia } from '../components/CachedMedia'
import { swrQuery, dropCache, FRESH_SHORT, FRESH_MEDIUM } from '../lib/dataCache'
import './AkunPage.css'

const TYPE_OPTIONS = [
  { value: 'request', label: '📩 Request Prompt', desc: 'Minta tool/prompt baru' },
  { value: 'bug', label: '🐛 Lapor Bug', desc: 'Fitur rusak/error' },
  { value: 'glitch', label: '⚡ Glitch', desc: 'Tampilan aneh/minor' },
  { value: 'feedback', label: '💬 Feedback', desc: 'Saran umum' },
]

/**
 * v5.5 — BATAS LAMPIRAN DISAMAKAN JADI 2 MB
 *
 * Sebelumnya video boleh 5 MB. Angka itu menyesatkan: lampiran dikirim ke
 * Edge Function dalam bentuk base64, yang membengkakkan ukurannya ~33%.
 * Video 5 MB berarti body request ~6,7 MB, dan file itu nanti diunduh lagi
 * oleh admin lewat signed URL — dua kali kena egress untuk satu laporan.
 *
 * Batas baru 2 MB untuk foto maupun video. Angka ini HARUS sama dengan yang
 * ada di supabase/functions/submit-feedback/index.ts. Kalau salah satu saja
 * diubah, user akan melihat pesan gagal yang membingungkan.
 */
const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024 // 2MB — foto & video

function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1).replace('.0', '')
}

export default function AkunPage() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [bookmarks, setBookmarks] = useState([])
  const [activeTab, setActiveTab] = useState('bookmarks')

  // Feedback form state
  const [feedbackType, setFeedbackType] = useState(searchParams.get('type') || 'request')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackFile, setFeedbackFile] = useState(null)
  const [feedbackFilePreview, setFeedbackFilePreview] = useState('')
  const [projectId, setProjectId] = useState(searchParams.get('project_id') || '')
  const [projectName, setProjectName] = useState(searchParams.get('project_name') || '')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [feedbackEnabled, setFeedbackEnabled] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchBookmarks()
    checkFeedbackEnabled()

    if (searchParams.get('type')) {
      setActiveTab('request')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  /**
   * Preview lampiran.
   *
   * Object URL dibuat di dalam effect dan dilepas di cleanup-nya. Pola ini
   * penting: kalau revoke dipanggil di tempat lain (misalnya langsung setelah
   * createObjectURL, atau di handler tombol), gambar bisa hilang sebelum
   * browser sempat menggambarnya.
   */
  useEffect(() => {
    if (!feedbackFile) {
      setFeedbackFilePreview('')
      return
    }
    const url = URL.createObjectURL(feedbackFile)
    setFeedbackFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [feedbackFile])

  async function fetchBookmarks() {
    try {
      const { data } = await swrQuery(
        `bookmarks:${user.id}`,
        async () => {
          const { data, error } = await supabase
            .from('bookmarks')
            .select('projects(id,title,thumbnail_url,content_type)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
          if (error) throw error
          return (data || []).map(b => b.projects).filter(Boolean)
        },
        { freshMs: FRESH_SHORT, onRevalidated: setBookmarks },
      )
      setBookmarks(data || [])
    } catch {
      setBookmarks([])
    }
  }

  async function checkFeedbackEnabled() {
    try {
      const { data } = await swrQuery(
        'site_settings:feedback_enabled',
        async () => {
          const { data, error } = await supabase
            .from('site_settings')
            .select('feedback_enabled')
            .eq('id', 1)
            .maybeSingle()
          if (error) throw error
          return data || null
        },
        {
          freshMs: FRESH_MEDIUM,
          onRevalidated: (d) => setFeedbackEnabled(d ? d.feedback_enabled !== false : true),
        },
      )
      setFeedbackEnabled(data ? data.feedback_enabled !== false : true)
    } catch {
      setFeedbackEnabled(true)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function handleFileSelect(e) {
    const input = e.target
    const file = input.files?.[0]

    // Reset nilai input supaya memilih file yang SAMA dua kali tetap memicu
    // onChange. Tanpa ini, user yang menghapus lampiran lalu memilih file
    // yang sama merasa tombolnya tidak berfungsi.
    input.value = ''

    if (!file) return

    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if (!isImage && !isVideo) {
      setFeedbackFile(null)
      return setError('Format tidak didukung. Foto: JPEG/PNG/WebP. Video: MP4.')
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      setFeedbackFile(null)
      return setError(
        `Ukuran ${isVideo ? 'video' : 'foto'} maksimal ${formatMB(MAX_ATTACHMENT_SIZE)}MB. ` +
        `File kamu ${formatMB(file.size)}MB — coba dipotong atau dikecilkan dulu.`,
      )
    }

    setFeedbackFile(file)
    setError('')
  }

  async function handleSubmitFeedback(e) {
    e.preventDefault()
    if (!feedbackMessage.trim()) return setError('Pesan tidak boleh kosong')

    setSending(true)
    setError('')
    setSuccess(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const body = {
        message: feedbackMessage.trim(),
        type: feedbackType,
        project_id: projectId || undefined,
      }

      if (feedbackFile) {
        // Penjagaan terakhir sebelum kirim: ukuran bisa saja berubah kalau
        // state sempat diutak-atik dari luar handler pemilihan file.
        if (feedbackFile.size > MAX_ATTACHMENT_SIZE) {
          setSending(false)
          return setError(`Lampiran melebihi ${formatMB(MAX_ATTACHMENT_SIZE)}MB.`)
        }

        const reader = new FileReader()
        const base64 = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result).split(',')[1])
          reader.onerror = () => reject(new Error('Gagal membaca file'))
          reader.readAsDataURL(feedbackFile)
        })
        body.attachment_base64 = base64
        body.attachment_mime = feedbackFile.type
        body.attachment_filename = feedbackFile.name
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-feedback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        }
      )
      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Gagal mengirim')
      } else {
        setSuccess(true)
        setFeedbackMessage('')
        setFeedbackFile(null)
        setProjectId('')
        setProjectName('')
        setTimeout(() => setSuccess(false), 5000)
      }
    } catch (err) {
      setError(`Gagal: ${err.message}`)
    }
    setSending(false)
  }

  async function removeBookmarkCacheAndReload() {
    await dropCache(`bookmarks:${user.id}`)
    fetchBookmarks()
  }

  const roleLabel = profile?.role === 'architect' ? 'Architect' : profile?.role === 'admin' ? 'Administrator' : 'Member'

  return (
    <div className="akun-page animate-fadeIn">
      {/* ── PROFILE HEADER ── */}
      <div className="profile-header card">
        <div className="profile-avatar">
          {profile?.display_name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div className="profile-info">
          <h2 className="profile-name">{profile?.display_name || 'User PromptHub'}</h2>
          <p className="profile-email">{user?.email}</p>
          <span className="profile-role">
            Status: <strong>{roleLabel}</strong>
          </span>
        </div>
        <button className="btn-logout" onClick={handleSignOut}>
          <LogOut size={16} /> Keluar
        </button>
      </div>

      {/* ── TABS ── */}
      <div className="akun-tabs">
        <button
          className={`tab-btn ${activeTab === 'bookmarks' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookmarks')}
        >
          <Bookmark size={16} /> Favorit Saya
        </button>
        <button
          className={`tab-btn ${activeTab === 'request' ? 'active' : ''}`}
          onClick={() => setActiveTab('request')}
        >
          <Send size={16} /> Kirim Masukan
        </button>
      </div>

      {/* ── TAB CONTENT: BOOKMARKS ── */}
      {activeTab === 'bookmarks' && (
        <div className="tab-content bookmarks-content">
          {bookmarks.length === 0 ? (
            <div className="empty-state">
              <Clock size={40} />
              <p>Belum ada tool yang difavoritkan.</p>
              <button className="btn btn-primary" onClick={() => navigate('/tools')}>Cari Tool</button>
              <button
                className="btn btn-ghost"
                style={{ marginTop: 8, fontSize: 12 }}
                onClick={removeBookmarkCacheAndReload}
              >
                Muat ulang daftar
              </button>
            </div>
          ) : (
            <div className="bookmarks-grid">
              {bookmarks.map(item => {
                const typeLabel = item.content_type === 'generator' ? 'Generator' : 'Prompt'
                return (
                  <div key={item.id} className="bookmark-card card" onClick={() => navigate(`/tools/${item.id}`)}>
                    <CardMedia
                      url={item.thumbnail_url}
                      alt={item.title}
                      className="bookmark-thumb"
                      emptyClassName="bookmark-thumb"
                    />
                    <div className="bookmark-details">
                      <h4>{item.title}</h4>
                      <span className="badge">{typeLabel}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB CONTENT: FEEDBACK ── */}
      {activeTab === 'request' && (
        <div className="tab-content request-content card">
          <h3 style={{marginBottom: 8, fontSize: 18}}>Kirim Masukan / Laporan</h3>

          {!feedbackEnabled ? (
            <div style={{
              padding: '16px', borderRadius: '10px', textAlign: 'center',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#fca5a5', fontSize: '13px', lineHeight: 1.6,
            }}>
              🚫 Fitur masukan sedang dinonaktifkan sementara oleh admin. Coba lagi nanti.
            </div>
          ) : (
            <>
              <p style={{fontSize: 12, color: 'var(--text-muted)', marginBottom: 16}}>
                Punya ide, temukan bug, atau ingin kasih feedback? Kirim ke admin! (Maks 2/hari)
              </p>

              {projectName && (
                <div style={{
                  padding: '8px 12px', borderRadius: '8px', marginBottom: '12px',
                  background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                  fontSize: '12px', color: 'var(--accent)',
                }}>
                  📦 Terkait: <strong>{projectName}</strong>
                  <button
                    onClick={() => { setProjectId(''); setProjectName('') }}
                    style={{ marginLeft: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}
                  >✕ Hapus</button>
                </div>
              )}

              <form onSubmit={handleSubmitFeedback} className="request-form">
                <div className="field-group">
                  <label className="field-label">Tipe Masukan</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    {TYPE_OPTIONS.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setFeedbackType(t.value)}
                        style={{
                          padding: '8px 10px', borderRadius: '8px', textAlign: 'left',
                          fontSize: '12px', cursor: 'pointer', border: 'none',
                          background: feedbackType === t.value ? 'rgba(99,102,241,0.15)' : 'var(--bg-dark, #1a1a2e)',
                          color: feedbackType === t.value ? 'var(--accent)' : 'var(--text-muted)',
                          outline: feedbackType === t.value ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{t.label}</div>
                        <div style={{ fontSize: '10px', opacity: 0.7 }}>{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">Pesan *</label>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Ceritakan detail masukan kamu..."
                    value={feedbackMessage}
                    onChange={e => setFeedbackMessage(e.target.value)}
                    required
                    maxLength={2000}
                  />
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {feedbackMessage.length}/2000
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">
                    Lampiran (Opsional) — foto atau video, maksimal {formatMB(MAX_ATTACHMENT_SIZE)}MB
                  </label>
                  {feedbackFilePreview ? (
                    <div className="media-preview-box">
                      {feedbackFile?.type?.startsWith('video/') ? (
                        <video src={feedbackFilePreview} controls className="preview-media" />
                      ) : (
                        <img src={feedbackFilePreview} alt="Preview" className="preview-media" />
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {feedbackFile?.name} — {formatMB(feedbackFile?.size || 0)}MB
                      </div>
                      <button type="button" className="btn-remove-media" onClick={() => setFeedbackFile(null)}>
                        <X size={14} /> Hapus
                      </button>
                    </div>
                  ) : (
                    <label className="upload-dropzone">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                      />
                      <UploadCloud size={32} className="upload-icon-lg" />
                      <span className="upload-text">Klik untuk memilih foto atau video</span>
                    </label>
                  )}
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                    ❌ {error}
                  </div>
                )}

                {success && (
                  <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--accent-green)', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                    ✅ Masukan berhasil dikirim! Terima kasih.
                  </div>
                )}

                <button type="submit" className="btn btn-primary" disabled={sending || !feedbackEnabled}>
                  {sending ? 'Mengirim...' : <><Send size={16}/> Kirim Masukan</>}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  )
}
