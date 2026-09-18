import { useNavigate } from 'react-router-dom'
import { makeExcerpt, formatDate, readingTime } from '../lib/articleUtils'

/**
 * Satu kartu untuk Info AI maupun Tips & Trik.
 *
 * Bentuknya sengaja dibuat sama persis untuk semua kartu: kotak gambar
 * dengan rasio tetap, judul dipotong 2 baris, ringkasan dipotong 2 baris.
 * Dengan begitu tinggi setiap kartu identik dan tidak ada lagi frame
 * kosong ketika ada thumbnail yang jauh lebih tinggi dari yang lain.
 *
 * variant:
 *   'news'  -> Info AI, aksen biru
 *   'tips'  -> Tips & Trik, aksen kuning + garis bawah gambar (kesan modul)
 * featured: kartu pertama di Info AI, gambar lebih besar & ringkasan 3 baris.
 */
export default function ArticleCard({ article, variant = 'news', featured = false }) {
  const navigate = useNavigate()

  const excerpt = article.excerpt?.trim() || makeExcerpt(article.content, featured ? 180 : 130)
  const minutes = readingTime(article.content)
  const date = formatDate(article.created_at, featured ? 'long' : 'short')

  function open() { navigate(`/artikel/${article.id}`) }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() }
  }

  return (
    <article
      className={`ah-card ah-card--${variant} ${featured ? 'ah-card--featured' : ''}`}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyDown}
      aria-label={`Buka artikel ${article.title}`}
    >
      <div className="ah-media">
        {article.thumbnail_url ? (
          <img
            className="ah-img"
            src={article.thumbnail_url}
            alt=""
            loading="lazy"
            onError={e => { e.currentTarget.style.visibility = 'hidden' }}
          />
        ) : (
          <div className="ah-img ah-img--empty" aria-hidden="true">
            {variant === 'tips' ? '💡' : '📰'}
          </div>
        )}
        <span className="ah-chip">
          {featured ? 'Terbaru' : (variant === 'tips' ? 'Panduan' : 'Info AI')}
        </span>
      </div>

      <div className="ah-body">
        <div className="ah-meta">
          <span>{date}</span>
          {minutes > 0 && <span>{minutes} menit baca</span>}
        </div>
        <h3 className="ah-title">{article.title}</h3>
        {excerpt
          ? <p className="ah-excerpt">{excerpt}</p>
          : <p className="ah-excerpt ah-excerpt--empty">Ketuk untuk membuka artikel ini.</p>}
      </div>
    </article>
  )
}
