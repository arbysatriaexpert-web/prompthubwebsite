import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ArticleCard from '../components/ArticleCard'
import './ArticlesPage.css'

export default function TipsPage() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function fetchArticles() {
      setLoading(true)
      const { data } = await supabase
        .from('articles')
        .select('id,title,thumbnail_url,excerpt,created_at')
        .eq('category', 'tips')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(40)
      if (!alive) return
      setArticles(data || [])
      setLoading(false)
    }
    fetchArticles()
    return () => { alive = false }
  }, [])

  return (
    <div className="articles-page animate-fadeIn">
      <div className="page-header">
        <h1 className="page-title">Tips &amp; Trik 💡</h1>
        <p className="page-subtitle">Panduan meracik prompt dan memaksimalkan hasil AI</p>
      </div>

      <div className="articles-list">
        {loading ? (
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
