import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ArrowLeft, Heart, Copy, Check, Bug, ExternalLink, AlertCircle, Play, ChevronDown, ChevronUp } from 'lucide-react'
import { CachedVideo } from '../../components/CachedMedia'
import { swrQuery, dropCache, FRESH_SHORT } from '../../lib/dataCache'
import './ToolDetailPage.css'

/* ── Helper YouTube ───────────────────────────────────────── */
function getYouTubeId(url = '') {
  if (!url) return ''
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /[?&]v=([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/live\/([A-Za-z0-9_-]{6,})/,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return m[1]
  }
  return ''
}

const RATIO_MAP = { '16:9': '16 / 9', '9:16': '9 / 16', '1:1': '1 / 1' }

/**
 * Pemutar video tutorial.
 * YouTube dirender sebagai facade: thumbnail + tombol play buatan sendiri.
 * Iframe baru dipasang setelah tombol ditekan (autoplay=1), jadi klik pasti
 * ditangani oleh halaman kita — bukan oleh iframe yang sering menolak event
 * di dalam webview atau saat device emulation DevTools aktif.
 */
function TutorialPlayer({ url, ratio, poster }) {
  const [playing, setPlaying] = useState(false)
  const ytId = getYouTubeId(url)
  const aspect = RATIO_MAP[ratio] || '16 / 9'
  const isPortrait = ratio === '9:16'

  const frameStyle = {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#000',
    aspectRatio: aspect,
    width: '100%',
    maxWidth: isPortrait ? 300 : '100%',
    margin: '0 auto',
  }

  // v5.5 — video yang di-host sendiri (bukan YouTube) tidak lagi dipasang
  // langsung. CachedVideo menahan unduhan sampai tombol play ditekan, lalu
  // menyimpan filenya di device supaya pemutaran berikutnya tidak menyentuh
  // Supabase sama sekali. Ini pos egress terbesar di halaman detail.
  if (!ytId) {
    return (
      <div style={frameStyle}>
        <CachedVideo
          src={url}
          poster={poster || undefined}
          mode="click"
          controls
          maxBytes={80 * 1024 * 1024}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    )
  }

  return (
    <div>
      <div style={frameStyle}>
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
            title="Tutorial"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label="Putar video tutorial"
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              border: 'none', padding: 0, cursor: 'pointer', background: '#000',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <img
              src={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
            />
            <span style={{
              position: 'relative', width: 58, height: 58, borderRadius: '50%',
              background: 'rgba(239,68,68,0.95)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
            }}>
              <Play size={26} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />
            </span>
          </button>
        )}
      </div>

      <a
        href={`https://www.youtube.com/watch?v=${ytId}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8,
          fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none',
        }}
      >
        <ExternalLink size={11} /> Buka di YouTube
      </a>
    </div>
  )
}

/* ── Halaman ──────────────────────────────────────────────── */
export default function ToolDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [promptExpanded, setPromptExpanded] = useState(false)

  useEffect(() => {
    let alive = true

    async function fetchData() {
      setLoading(true)

      // v5.5 — baris project disimpan di device 5 menit. Bolak-balik antara
      // daftar dan detail (pola paling umum) jadi tidak memicu query baru.
      // prompt_data berukuran besar, jadi ini penghematan yang nyata.
      try {
        const { data } = await swrQuery(
          `project:${id}`,
          async () => {
            const { data, error } = await supabase
              .from('projects')
              .select('*, categories(name)')
              .eq('id', id)
              .maybeSingle()
            if (error) throw error
            return data || null
          },
          { freshMs: FRESH_SHORT, onRevalidated: (d) => { if (alive) setProject(d) } },
        )
        if (!alive) return
        setProject(data)
      } catch {
        if (alive) setProject(null)
      }

      if (user) {
        const { data: bm } = await supabase
          .from('bookmarks').select('id')
          .eq('project_id', id).eq('user_id', user.id).maybeSingle()
        if (alive) setIsBookmarked(!!bm)
      }
      if (alive) setLoading(false)
    }

    fetchData()
    return () => { alive = false }
  }, [id, user])

  const promptText = project?.prompt_data?.prompt_text || project?.prompt_text || ''
  const isGenerator = project?.content_type === 'generator'

  async function handleCopy() {
    if (!promptText) return
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(promptText)
      } else {
        const ta = document.createElement('textarea')
        ta.value = promptText
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      supabase.from('analytics').insert({ project_id: id, action_type: 'copy' })
    } catch (err) {
      console.error('Gagal menyalin', err)
    }
  }

  async function toggleBookmark() {
    if (!user) return navigate('/login')
    if (isBookmarked) {
      setIsBookmarked(false)
      await supabase.from('bookmarks').delete().eq('project_id', id).eq('user_id', user.id)
    } else {
      setIsBookmarked(true)
      await supabase.from('bookmarks').insert({ project_id: id, user_id: user.id })
    }
    // Daftar favorit di halaman Akun ikut di-cache, jadi cache-nya dibuang
    // supaya perubahan langsung terlihat di sana.
    dropCache(`bookmarks:${user.id}`).catch(() => {})
  }

  if (loading) return <div className="detail-loading">Memuat...</div>
  if (!project) return <div className="detail-loading">Tool tidak ditemukan.</div>

  return (
    <div className="tool-detail-page">
      {/* ── NAVIGASI ── */}
      <div className="detail-header">
        <button className="btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <div className="header-actions">
          <button className="btn-icon" onClick={toggleBookmark} aria-label="Favorit"
            style={{ color: isBookmarked ? '#ef4444' : 'var(--text-primary)' }}>
            <Heart size={20} fill={isBookmarked ? '#ef4444' : 'none'} />
          </button>
        </div>
      </div>

      {/* ══ 1. JUDUL ══ */}
      <div className="detail-info">
        {project.categories?.name && <div className="category-badge">{project.categories.name}</div>}
        <h1 className="detail-title">{project.title}</h1>
      </div>

      {/* ══ 2. VIDEO TUTORIAL ══ */}
      {project.tutorial_video_url && (
        <div style={{ padding: '0 16px', marginTop: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-white)', marginBottom: 10 }}>
            🎬 Video Tutorial
          </h3>
          <TutorialPlayer
            url={project.tutorial_video_url}
            ratio={project.tutorial_aspect_ratio || '16:9'}
            poster={project.thumbnail_url}
          />
        </div>
      )}

      {/* Video showcase tambahan (kalau diisi) */}
      {project.video_url && (
        <div style={{ padding: '0 16px', marginTop: 16 }}>
          <TutorialPlayer url={project.video_url} ratio={project.aspect_ratio || '16:9'} poster={project.thumbnail_url} />
        </div>
      )}

      {/* ══ 3. DESKRIPSI ══ */}
      {project.description && (
        <div style={{ padding: '0 16px', marginTop: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-white)', marginBottom: 8 }}>
            Deskripsi
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {project.description}
          </p>
        </div>
      )}

      {/* ══ 4. PROMPT / GENERATOR ══ */}
      <div className="detail-content" style={{ padding: '0 16px', marginTop: 18 }}>
        {isGenerator ? (
          project.tool_url ? (
            <div className="card" style={{ padding: 16 }}>
              <h3 className="card-heading" style={{ marginBottom: 6 }}>Generator Interaktif</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                Tool ini berjalan di halaman terpisah. Tekan tombol di bawah untuk membukanya.
              </p>
              <a href={project.tool_url} target="_blank" rel="noopener noreferrer"
                className="btn btn-primary w-full"
                onClick={() => supabase.from('analytics').insert({ project_id: id, action_type: 'open_tool' })}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, textDecoration: 'none' }}>
                <ExternalLink size={16} /> Buka Generator
              </a>
            </div>
          ) : (
            <div className="card" style={{
              padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <AlertCircle size={18} style={{ color: '#fca5a5', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.6 }}>
                Generator ini belum punya link tool. Admin perlu mengisi <strong>Tool URL</strong> di panel.
              </div>
            </div>
          )
        ) : (
          <div className="copy-paste-card card">
            <h3 className="card-heading">Teks Prompt</h3>
            {promptText ? (
              <>
                <div style={{ position: 'relative' }}>
                  <div className="prompt-text-box" style={{ 
                    maxHeight: promptExpanded ? 'none' : '150px', 
                    overflow: 'hidden', 
                    transition: 'max-height 0.3s ease',
                    marginBottom: promptExpanded ? '16px' : '0'
                  }}>
                    {promptText}
                  </div>
                  {!promptExpanded && (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '60px',
                      background: 'linear-gradient(transparent, var(--bg-card))',
                      pointerEvents: 'none'
                    }} />
                  )}
                </div>
                
                <button 
                  className="btn btn-ghost w-full mt-2" 
                  onClick={() => setPromptExpanded(!promptExpanded)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, marginBottom: promptExpanded ? 12 : 0 }}
                >
                  {promptExpanded ? <><ChevronUp size={16} /> Sembunyikan</> : <><ChevronDown size={16} /> Baca Selengkapnya</>}
                </button>

                <button className="btn btn-primary w-full" onClick={handleCopy}>
                  {copied ? <><Check size={16} /> Disalin!</> : <><Copy size={16} /> Salin Prompt</>}
                </button>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, padding: '8px 0' }}>
                Teks prompt belum diisi oleh admin.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ 5. LAPOR BUG (penutup) ══ */}
      {user && (
        <div style={{ padding: '0 16px', margin: '20px 0 24px' }}>
          <button className="btn btn-ghost w-full"
            onClick={() => navigate(`/akun?type=bug&project_id=${project.id}&project_name=${encodeURIComponent(project.title)}`)}
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Bug size={14} /> Laporkan Bug / Masukan untuk Tool Ini
          </button>
        </div>
      )}
    </div>
  )
}
