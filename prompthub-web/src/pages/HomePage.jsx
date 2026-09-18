import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Play, FileText, ChevronRight } from 'lucide-react'
import { makeExcerpt, formatDate, safeUrl } from '../lib/articleUtils'
import { CardMedia, CachedImage } from '../components/CachedMedia'
import { swrQuery, FRESH_SHORT, FRESH_LONG } from '../lib/dataCache'
import './HomePage.css'
import './ArticlesPage.css'

/**
 * v5.5 — perubahan di halaman ini:
 *  - Hasil query disimpan di device (dataCache). Kembali ke Home dari halaman
 *    lain tidak lagi memicu 3–5 request baru ke Supabase setiap kali.
 *  - Semua thumbnail lewat CardMedia: video baru diunduh setelah kartunya
 *    terlihat, dan hanya sekali seumur device.
 *  - Slide carousel ikut aturan yang sama; slide yang belum tampil (terpotong
 *    overflow:hidden) tidak mengunduh apa-apa.
 */

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

  /* ── Slide & kategori: milik semua orang, umur cache panjang ────── */
  useEffect(() => {
    let alive = true

    swrQuery(
      'home:slides',
      async () => {
        const { data, error } = await supabase
          .from('hero_slides')
          .select('id,image_url,title,tag_text,link_to,sort_order')
          .eq('is_active', true)
          .order('sort_order')
        if (error) throw error
        return data || []
      },
      { freshMs: FRESH_LONG, onRevalidated: (d) => { if (alive) setSlides(d) } },
    ).then(({ data }) => { if (alive) setSlides(data || []) }).catch(() => {})

    swrQuery(
      'categories:active',
      async () => {
        const { data, error } = await supabase
          .from('categories')
          .select('id,name,icon,slug,sort_order')
          .eq('is_active', true)
          .order('sort_order')
        if (error) throw error
        return data || []
      },
      { freshMs: FRESH_LONG, onRevalidated: (d) => { if (alive) setCategories(d) } },
    ).then(({ data }) => { if (alive) setCategories(data || []) }).catch(() => {})

    return () => { alive = false }
  }, [])

  /* ── Konten utama: beda untuk tamu dan user login ───────────────── */
  useEffect(() => {
    let alive = true
    setLoading(true)

    const cacheKey = user ? 'home:content:auth' : 'home:content:guest'

    async function fetchContent() {
      if (user) {
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
        return {
          featured: projRes.error ? [] : (projRes.data || []),
          trending: trendRes.error ? [] : (trendRes.data || []),
          tips: tipsRes.error ? [] : (tipsRes.data || []),
        }
      }

      // Belum login: RPC preview yang HANYA mengirim judul + thumbnail.
      const [prevRes, tipsRes] = await Promise.all([
        supabase.rpc('public_home_preview'),
        supabase.rpc('public_tips_preview'),
      ])
      const rows = prevRes.data || []
      return {
        featured: rows.filter(r => r.is_featured)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).slice(0, 6),
        trending: rows.filter(r => r.is_trending)
          .sort((a, b) => (a.trending_order || 0) - (b.trending_order || 0)).slice(0, 6),
        tips: tipsRes.data || [],
      }
    }

    function apply(d) {
      setFeaturedProjects(d.featured || [])
      setTrendingProjects(d.trending || [])
      setTipsArticles(d.tips || [])
    }

    swrQuery(cacheKey, fetchContent, {
      freshMs: FRESH_SHORT,
      onRevalidated: (d) => { if (alive) apply(d) },
    })
      .then(({ data }) => {
        if (!alive) return
        apply(data)
        setLoading(false)
      })
      .catch(() => { if (alive) setLoading(false) })

    return () => { alive = false }
  }, [user])

  /**
   * Link absolut: hanya http/https yang diizinkan. Tanpa penyaringan ini,
   * isi kolom "javascript:..." dari panel akan dieksekusi browser saat diklik.
   */
  function handleSlideClick(slide) {
    const raw = (slide.link_to || '').trim()
    if (!raw) return

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
        <CardMedia url={proj.thumbnail_url} alt={proj.title} className="card-bg" />
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
          {loading && slides.length === 0 ? (
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
                    <CardMedia
                      url={slide.image_url}
                      alt={slide.title}
                      className="slide-image"
                      style={{ pointerEvents: 'none' }}
                      emptyClassName="slide-image"
                    />
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
          {categories.length === 0 ? (
            Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ width: 100, height: 36, borderRadius: 20, flexShrink: 0 }} />)
          ) : (
            categories.map(cat => (
              <div key={cat.id} className="category-item" onClick={() => navigate(`/tools?category=${cat.slug || cat.id}`)}>
                <div className="cat-image-box">
                  {cat.icon?.startsWith('http') ? (
                    <CachedImage src={cat.icon} alt={cat.name} />
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

        {loading && featuredProjects.length === 0 ? (
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
      {trendingProjects.length > 0 && (
        <section className="featured-section">
          <div className="section-header">
            <h2 className="section-title">Lagi Tren Sekarang 🔥</h2>
          </div>
          <div className="gallery-grid">{trendingProjects.map(renderCard)}</div>
        </section>
      )}

      {/* 3C. TIPS & TRIK */}
      {tipsArticles.length > 0 && (
        <section className="featured-section">
          <div className="section-header">
            <h2 className="section-title">Tips &amp; Trik 💡</h2>
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
                      ? <CachedImage className="ah-img" src={art.thumbnail_url} alt="" />
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
