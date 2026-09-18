import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ArticleCard from '../components/ArticleCard'
import { swrQuery, FRESH_SHORT } from '../lib/dataCache'
import './ArticlesPage.css'

/**
 * v5.5 — sama seperti InfoPage: hasil query disimpan di device 5 menit.
 */
export default function TipsPage() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    swrQuery(
      'articles:tips',
      async () => {
        const { data, error } = await supabase
          .from('articles')
          .select('id,title,thumbnail_url,excerpt,created_at')
          .eq('category', 'tips')
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
        <h1 className="page-title">Tips &amp; Trik 💡</h1>
        <p className="page-subtitle">Panduan meracik prompt dan memaksimalkan hasil AI</p>
      </div>

      <div className="articles-list">
        {loading && articles.length === 0 ? (
          <div className="ah-grid">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="skeleton" style={{ aspectRatio: '16 / 11', borderRadius: 16 }} />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="empty-state">Belum ada panduan yang dipublish.</div>
        ) : (
          <div className="ah-grid">
            {articles.map(a => (
              <ArticleCard key={a.id} article={a} variant="tips" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
