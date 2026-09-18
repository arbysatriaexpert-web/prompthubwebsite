import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { RichText, safeUrl, formatDate, readingTime } from '../lib/articleUtils'
import './ArticlesPage.css'

export default function ArticleDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('articles')
        .select('id,title,content,thumbnail_url,external_url,external_button_label,category,created_at')
        .eq('id', id)
        .maybeSingle()
      if (!alive) return
      setArticle(data)
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [id])

  const isTips = article?.category === 'tips'

  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate(isTips ? '/tips' : '/info')
  }

  if (loading) {
    return <div className="ah-notice"><div className="ah-notice-text">Memuat artikel…</div></div>
  }

  // Tamu memang tidak boleh membaca isi artikel (aturan database),
  // jadi jangan tampilkan "tidak ditemukan" yang menyesatkan.
  if (!article && !user) {
    return (
      <div className="ah-notice">
        <div className="ah-notice-title">Login dulu untuk membaca</div>
        <div className="ah-notice-text">Artikel lengkap hanya terbuka untuk pengguna yang sudah masuk.</div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="ah-notice">
        <div className="ah-notice-title">Artikel tidak ditemukan</div>
        <div className="ah-notice-text">Artikel ini mungkin sudah dihapus atau statusnya diubah jadi draft.</div>
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate('/info')}>
          Lihat daftar artikel
        </button>
      </div>
    )
  }

  const sourceUrl = safeUrl(article.external_url)
  const minutes = readingTime(article.content)
  let sourceHost = ''
  if (sourceUrl) {
    try { sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, '') } catch { sourceHost = '' }
  }

  return (
    <div className="ah-article animate-fadeIn">
      <div className="ah-topbar">
        <button className="ah-back" onClick={goBack}>
          <ArrowLeft size={16} /> Kembali
        </button>
      </div>

      <div className="ah-article-inner">
        {article.thumbnail_url && (
          <div className="ah-hero">
            <img src={article.thumbnail_url} alt="" />
          </div>
        )}

        {/* 1. Judul + keterangan singkat */}
        <div className="ah-kicker">
          <span className={`ah-kicker-tag ${isTips ? 'ah-kicker-tag--tips' : ''}`}>
            {isTips ? 'Tips & Trik' : 'Info AI'}
          </span>
          <span>{formatDate(article.created_at)}</span>
          {minutes > 0 && <span>{minutes} menit baca</span>}
        </div>

        <h1 className="ah-article-title">{article.title}</h1>
        <hr className="ah-article-sep" />

        {/* 2. Isi berita / keterangan */}
        {article.content?.trim()
          ? <RichText text={article.content} />
          : <p className="ah-p" style={{ color: 'var(--text-muted)' }}>
              Isi artikel belum ditulis. {sourceUrl ? 'Silakan buka sumbernya di bawah.' : ''}
            </p>}

        {/* 3. Tombol ke sumber, sebagai penutup */}
        {sourceUrl && (
          <div className="ah-source">
            <div className="ah-source-label">Sumber lengkap</div>
            {sourceHost && <div className="ah-source-host">{sourceHost}</div>}
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary ah-source-btn"
            >
              <ExternalLink size={16} /> {article.external_button_label || 'Buka sumber'}
            </a>
          </div>
        )}

        <div className="ah-endnote">
          <button className="btn btn-ghost" onClick={() => navigate(isTips ? '/tips' : '/info')}>
            {isTips ? 'Lihat panduan lainnya' : 'Lihat berita lainnya'}
          </button>
        </div>
      </div>
    </div>
  )
}
