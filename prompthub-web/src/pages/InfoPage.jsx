import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ArticleCard from '../components/ArticleCard'
import { swrQuery, FRESH_SHORT } from '../lib/dataCache'
import './ArticlesPage.css'

/**
 * v5.5 — daftar artikel disimpan di device selama 5 menit (dataCache).
 * Pindah tab Info → Tips → Info tidak lagi mengirim query baru tiap kali.
 */
export default function InfoPage() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    swrQuery(
      'articles:info-ai',
      async () => {
        const { data, error } = await supabase
          .from('articles')
          .select('id,title,thumbnail_url,excerpt,created_at')
          .eq('category', 'info-ai')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(40)
        if (error) throw error
        return data || []
      },
      { freshMs: FRESH_SHORT, onRevalidated: (d) => { if (alive) setArticles(d) } },
    )
      .then(({ data }) => {
        if (!alive) return
        setArticles(data || [])
        setLoading(false)
      })
      .catch(() => { if (alive) setLoading(false) })

    return () => { alive = false }
  }, [])

  return (
    <div className="articles-page animate-fadeIn">
      <div className="page-header">
        <h1 className="page-title">Info AI 📰</h1>
        <p className="page-subtitle">Berita dan perkembangan terbaru seputar Artificial Intelligence</p>
      </div>

      <div className="articles-list">
        {loading && articles.length === 0 ? (
          <div className="ah-grid">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="skeleton" style={{ aspectRatio: '16 / 11', borderRadius: 16 }} />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="empty-state">Belum ada berita terbaru.</div>
        ) : (
          <div className="ah-grid">
            {articles.map((a, i) => (
              <ArticleCard key={a.id} article={a} variant="news" featured={i === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
