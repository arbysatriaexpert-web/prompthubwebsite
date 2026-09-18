import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Play, FileText, ChevronRight } from 'lucide-react'
import { makeExcerpt, formatDate, safeUrl } from '../lib/articleUtils'
import './HomePage.css'
import './ArticlesPage.css'

export default function HomePage() {
  const [slides, setSlides] = useState([])
  const [categories, setCategories] = useState([])
  const [featuredProjects, setFeaturedProjects] = useState([])
  const [trendingProjects, setTrendingProjects] = useState([])
  const [tipsArticles, setTipsArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (slides.length <= 1) return
    const interval = setInterval(() => {
      setCurrentSlideIndex(prev => (prev + 1) % slides.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [slides])

  useEffect(() => {
    let alive = true

    async function fetchData() {
      setLoading(true)

      // Slide & kategori boleh dibaca siapa saja
      const [slideRes, catRes] = await Promise.all([
        supabase.from('hero_slides').select('id,image_url,title,tag_text,link_to,sort_order').eq('is_active', true).order('sort_order'),
        supabase.from('categories').select('id,name,icon,slug,sort_order').eq('is_active', true).order('sort_order'),
      ])
      if (!alive) return
      if (!slideRes.error) setSlides(slideRes.data || [])
      if (!catRes.error) setCategories(catRes.data || [])

      if (user) {
        // Sudah login: baca penuh, diurutkan sesuai urutan yang diatur di panel
        const [projRes, trendRes, tipsRes] = await Promise.all([
          supabase.from('projects').select('id,title,thumbnail_url,aspect_ratio,content_type')
            .eq('is_published', true).eq('is_featured', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false }).limit(6),
          supabase.from('projects').select('id,title,thumbnail_url,aspect_ratio,content_type')
            .eq('is_published', true).eq('is_trending', true)
            .order('trending_order', { ascending: true })
            .order('created_at', { ascending: false }).limit(6),
          supabase.from('articles').select('id,title,thumbnail_url,excerpt,created_at')
            .eq('is_published', true).eq('category', 'tips')
            .order('created_at', { ascending: false }).limit(3),
        ])
        if (!alive) return
        if (!projRes.error) setFeaturedProjects(projRes.data || [])
        if (!trendRes.error) setTrendingProjects(trendRes.data || [])
        if (!tipsRes.error) setTipsArticles(tipsRes.data || [])
      } else {
        // Belum login: pakai RPC preview yang HANYA mengirim judul + thumbnail.
        // Isi prompt dan tool_url tidak pernah dikirim ke tamu.
        const [prevRes, tipsRes] = await Promise.all([
          supabase.rpc('public_home_preview'),
          supabase.rpc('public_tips_preview'),
        ])
        if (!alive) return
        const rows = prevRes.data || []
        setFeaturedProjects(
          rows.filter(r => r.is_featured)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).slice(0, 6)
        )
        setTrendingProjects(
          rows.filter(r => r.is_trending)
            .sort((a, b) => (a.trending_order || 0) - (b.trending_order || 0)).slice(0, 6)
        )
        setTipsArticles(tipsRes.data || [])
      }

      if (alive) setLoading(false)
    }

    fetchData()
    return () => { alive = false }
  }, [user])

  /**
   * FIX: dulu slide hanya memanggil navigate(link_to) apa adanya.
   * Kalau admin mengisi URL lengkap (https://...) atau link tanpa garis miring
   * di depan, React Router tidak bisa memprosesnya dan halaman diam di Home.
   */
  function handleSlideClick(slide) {
    const raw = (slide.link_to || '').trim()
    if (!raw) return

    // Link absolut: hanya http/https yang diizinkan. Tanpa penyaringan ini,
    // isi kolom "javascript:..." dari panel akan dieksekusi browser saat diklik.
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      const safe = safeUrl(raw)
      if (!safe) return
      try {
        const url = new URL(safe)
        if (url.origin === window.location.origin) navigate(url.pathname + url.search)
        else window.open(safe, '_blank', 'noopener,noreferrer')
      } catch {
        window.open(safe, '_blank', 'noopener,noreferrer')
      }
      return
    }

    navigate(raw.startsWith('/') ? raw : `/${raw}`)
  }

  function renderCard(proj) {
    const ratio = (proj.aspect_ratio || '9:16').replace(':', '')
    return (
      <div
        key={proj.id}
        className={`gallery-card card-interactive ratio-${ratio}`}
        onClick={() => navigate(`/tools/${proj.id}`)}
      >
        {proj.thumbnail_url ? (
          proj.thumbnail_url.match(/\.(mp4|webm|ogg)$/i) ? (
            <video src={proj.thumbnail_url} autoPlay loop muted playsInline className="card-bg" style={{ objectFit: 'cover' }} />
          ) : (
            <img src={proj.thumbnail_url} alt={proj.title} className="card-bg" />
          )
        ) : (
          <div className="card-bg empty-bg" />
        )}
        <div className="card-content">
          <div className="card-type-badge">
            {proj.content_type === 'generator' ? <Play size={10} /> : <FileText size={10} />}
            <span>{proj.content_type === 'generator' ? 'Generator' : 'Prompt'}</span>
          </div>
          <h3 className="card-title">{proj.title}</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="home-page animate-fadeUp">
      {/* 1. HERO CAROUSEL */}
      <section className="hero-section">
        <div className="carousel-container">
          {loading ? (
            <div className="skeleton" style={{ height: '180px', borderRadius: '16px' }} />
          ) : slides.length > 0 ? (
            <>
              <div
                className="carousel-track"
                style={{
                  display: 'flex',
                  transition: 'transform 0.5s ease-in-out',
                  transform: `translateX(-${currentSlideIndex * 100}%)`,
                }}
              >
                {slides.map(slide => (
                  <div
                    key={slide.id}
                    className="carousel-slide"
                    role={slide.link_to ? 'button' : undefined}
                    onClick={() => handleSlideClick(slide)}
                    style={{ minWidth: '100%', flexShrink: 0, cursor: slide.link_to ? 'pointer' : 'default' }}
                  >
                    {slide.image_url && slide.image_url.match(/\.(mp4|webm|ogg)$/i) ? (
                      <video src={slide.image_url} autoPlay loop muted playsInline className="slide-image" style={{ objectFit: 'cover', pointerEvents: 'none' }} />
                    ) : (
                      <img src={slide.image_url || ''} alt={slide.title} className="slide-image" style={{ pointerEvents: 'none' }} />
                    )}
                    <div className="slide-overlay" style={{ pointerEvents: 'none' }}>
                      <span className="slide-tag">{slide.tag_text}</span>
                      <h3 className="slide-title">{slide.title}</h3>
                    </div>
                  </div>
                ))}
              </div>

              <div className="carousel-indicators">
                {slides.map((_, idx) => (
                  <div
                    key={idx}
                    className={`dot ${currentSlideIndex === idx ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setCurrentSlideIndex(idx) }}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="empty-hero"><p>Belum ada slide promo</p></div>
          )}
        </div>
      </section>

      {/* 2. KATEGORI */}
      <section className="categories-section">
        <div className="section-header">
          <h2 className="section-title">Kategori</h2>
        </div>
        <div className="categories-scroll">
          {loading ? (
            Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ width: 100, height: 36, borderRadius: 20, flexShrink: 0 }} />)
          ) : (
            categories.map(cat => (
              <div key={cat.id} className="category-item" onClick={() => navigate(`/tools?category=${cat.id}`)}>
                <div className="cat-image-box">
                  {cat.icon?.startsWith('http') ? (
                    <img src={cat.icon} alt={cat.name} />
                  ) : (
                    <span style={{ fontSize: '32px' }}>{cat.icon || '📁'}</span>
                  )}
                </div>
                <span className="cat-name">{cat.name}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 3. REKOMENDASI */}
      <section className="featured-section">
        <div className="section-header">
          <h2 className="section-title">Rekomendasi Pilihan 🔥</h2>
          <button className="btn-see-all" onClick={() => navigate('/tools')}>
            Lihat Semua <ChevronRight size={14} />
          </button>
        </div>

        {loading ? (
          <div className="gallery-grid">
            {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ paddingTop: '133%', borderRadius: 12 }} />)}
          </div>
        ) : featuredProjects.length === 0 ? (
          <p className="empty-text">Belum ada tool yang difeature.</p>
        ) : (
          <div className="gallery-grid">{featuredProjects.map(renderCard)}</div>
        )}
      </section>

      {/* 3B. TRENDING */}
      {(!loading && trendingProjects.length > 0) && (
        <section className="featured-section">
          <div className="section-header">
            <h2 className="section-title">Lagi Tren Sekarang 🔥</h2>
          </div>
          <div className="gallery-grid">{trendingProjects.map(renderCard)}</div>
        </section>
      )}

      {/* 3C. TIPS & TRIK */}
      {(!loading && tipsArticles.length > 0) && (
        <section className="featured-section">
          <div className="section-header">
            <h2 className="section-title">Tips & Trik 💡</h2>
            <button className="btn-see-all" onClick={() => navigate('/tips')}>
              Lihat Semua <ChevronRight size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 16px' }}>
            {tipsArticles.map(art => {
              const excerpt = art.excerpt?.trim() || makeExcerpt(art.content, 110)
              return (
                <div
                  key={art.id}
                  className="ah-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/artikel/${art.id}`)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/artikel/${art.id}`) }
                  }}
                >
                  <div className="ah-row-media">
                    {art.thumbnail_url
                      ? <img className="ah-img" src={art.thumbnail_url} alt="" loading="lazy" />
                      : <div className="ah-img ah-img--empty" aria-hidden="true">💡</div>}
                  </div>
                  <div className="ah-row-body">
                    <span className="ah-row-meta">{formatDate(art.created_at, 'short')}</span>
                    <h4 className="ah-row-title">{art.title}</h4>
                    {excerpt && <p className="ah-row-excerpt">{excerpt}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 4. CTA */}
      <section className="cta-section">
        <div className="cta-box">
          <h3>Punya ide prompt bagus?</h3>
          <p>Kirim request prompt atau bagikan karyamu ke admin untuk dimasukkan ke PromptHub!</p>
          <button className="btn btn-primary" onClick={() => navigate('/akun')}>
            Kirim Request 🚀
          </button>
        </div>
      </section>
    </div>
  )
}
