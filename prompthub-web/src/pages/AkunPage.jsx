import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { LogOut, Send, Bookmark, Clock, UploadCloud, X } from 'lucide-react'
import './AkunPage.css'

const TYPE_OPTIONS = [
  { value: 'request', label: '📩 Request Prompt', desc: 'Minta tool/prompt baru' },
  { value: 'bug', label: '🐛 Lapor Bug', desc: 'Fitur rusak/error' },
  { value: 'glitch', label: '⚡ Glitch', desc: 'Tampilan aneh/minor' },
  { value: 'feedback', label: '💬 Feedback', desc: 'Saran umum' },
]

const MAX_PHOTO_SIZE = 2 * 1024 * 1024  // 2MB
const MAX_VIDEO_SIZE = 5 * 1024 * 1024  // 5MB

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

    // Auto-switch to request tab if coming from ToolDetailPage
    if (searchParams.get('type')) {
      setActiveTab('request')
    }
  }, [user])

  async function fetchBookmarks() {
    const { data } = await supabase
      .from('bookmarks')
      .select('projects(id,title,thumbnail_url,content_type)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      
    if (data) {
      const formatted = data.map(b => b.projects).filter(Boolean)
      setBookmarks(formatted)
    }
  }

  async function checkFeedbackEnabled() {
    const { data } = await supabase
      .from('site_settings')
      .select('feedback_enabled')
      .eq('id', 1)
      .single()
    if (data) setFeedbackEnabled(data.feedback_enabled !== false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side size validation
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if (!isImage && !isVideo) {
      return setError('Format tidak didukung. Foto: JPEG/PNG/WebP. Video: MP4.')
    }

    if (isImage && file.size > MAX_PHOTO_SIZE) {
      return setError('Ukuran foto maksimal 2MB')
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      return setError('Ukuran video maksimal 5MB')
    }

    setFeedbackFile(file)
    setFeedbackFilePreview(URL.createObjectURL(file))
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
      
      // Prepare body
      const body = {
        message: feedbackMessage.trim(),
        type: feedbackType,
        project_id: projectId || undefined,
      }

      // If file, convert to base64
      if (feedbackFile) {
        const reader = new FileReader()
        const base64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result.split(',')[1])
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
        setFeedbackFilePreview('')
        setProjectId('')
        setProjectName('')
        setTimeout(() => setSuccess(false), 5000)
      }
    } catch (err) {
      setError(`Gagal: ${err.message}`)
    }
    setSending(false)
  }

  // Role label
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
            </div>
          ) : (
            <div className="bookmarks-grid">
              {bookmarks.map(item => {
                const isVideo = item.thumbnail_url?.match(/\.(mp4|webm|ogg)$/i)
                const typeLabel = item.content_type === 'generator' ? 'Generator' : 'Prompt'
                return (
                  <div key={item.id} className="bookmark-card card" onClick={() => navigate(`/tools/${item.id}`)}>
                    {isVideo ? (
                      <video src={item.thumbnail_url} className="bookmark-thumb" autoPlay muted loop playsInline />
                    ) : (
                      <img src={item.thumbnail_url || 'https://via.placeholder.com/150'} alt={item.title} className="bookmark-thumb" loading="lazy" />
                    )}
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

              {/* Project context from ToolDetailPage */}
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
                {/* Type picker */}
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
                  <label className="field-label">Lampiran (Opsional) — Foto max 2MB, Video max 5MB</label>
                  {feedbackFilePreview ? (
                    <div className="media-preview-box">
                      {feedbackFile?.type?.startsWith('video/') ? (
                        <video src={feedbackFilePreview} controls className="preview-media" />
                      ) : (
                        <img src={feedbackFilePreview} alt="Preview" className="preview-media" />
                      )}
                      <button type="button" className="btn-remove-media" onClick={() => { setFeedbackFile(null); setFeedbackFilePreview('') }}>
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
