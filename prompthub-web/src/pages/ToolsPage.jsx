import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Play, FileText, Search } from 'lucide-react'
import './ToolsPage.css'

export default function ToolsPage() {
  const [projects, setProjects] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [searchParams, setSearchParams] = useSearchParams()
  const activeCategorySlug = searchParams.get('category') || 'all'
  
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      
      const [projRes, catRes] = await Promise.all([
        supabase.from('projects').select('id,title,thumbnail_url,aspect_ratio,content_type,category_id,sort_order,categories(name,icon,slug)').eq('is_published', true).order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
        supabase.from('categories').select('id,name,icon,slug,sort_order').eq('is_active', true).order('sort_order')
      ])

      if (!projRes.error) setProjects(projRes.data || [])
      if (!catRes.error) setCategories(catRes.data || [])
      
      setLoading(false)
    }
    
    fetchData()
  }, [])

  // Filter by slug or fallback to category_id
  const filteredProjects = activeCategorySlug === 'all' 
    ? projects 
    : projects.filter(p => {
        const catSlug = p.categories?.slug
        return catSlug === activeCategorySlug || p.category_id === activeCategorySlug
      })

  return (
    <div className="tools-page animate-fadeIn">
      <div className="tools-header">
        <h1 className="page-title">Tools Prompt</h1>
        <p className="page-subtitle">Koleksi generator video dan prompt teks</p>
      </div>

      {/* FILTER KATEGORI */}
      <div className="filter-scroll">
        <button 
          className={`filter-chip ${activeCategorySlug === 'all' ? 'active' : ''}`}
          onClick={() => setSearchParams({})}
        >
          Semua
        </button>
        {categories.map(cat => (
          <button 
            key={cat.id} 
            className={`filter-chip ${activeCategorySlug === (cat.slug || cat.id) ? 'active' : ''}`}
            onClick={() => setSearchParams({ category: cat.slug || cat.id })}
          >
            {cat.icon?.startsWith('http') ? (
              <img src={cat.icon} alt={cat.name} style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }} />
            ) : (
              <span>{cat.icon}</span>
            )}
            {cat.name}
          </button>
        ))}
      </div>

      {/* GRID KONTEN */}
      {loading ? (
        <div className="tools-grid">
          {Array(6).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ paddingTop: '133%', borderRadius: 12 }} />)}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="empty-tools">
          <Search size={40} className="empty-icon" />
          <h3>Tidak ada konten</h3>
          <p>Belum ada tool atau prompt di kategori ini.</p>
        </div>
      ) : (
        <div className="tools-grid">
          {filteredProjects.map(proj => (
            <div 
              key={proj.id} 
              className={`tool-card card-interactive ratio-${(proj.aspect_ratio || '9:16').replace(':', '')}`}
              onClick={() => navigate(`/tools/${proj.id}`)}
            >
              {proj.thumbnail_url ? (
                proj.thumbnail_url.match(/\.(mp4|webm|ogg)$/i) ? (
                  <video src={proj.thumbnail_url} autoPlay loop muted playsInline className="card-bg" style={{ objectFit: 'cover' }} />
                ) : (
                  <img src={proj.thumbnail_url} alt={proj.title} className="card-bg" loading="lazy" />
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
                {proj.categories && (
                  <div className="card-category">
                    {proj.categories.name}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
