import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Play, FileText, Search } from 'lucide-react'
import { CardMedia } from '../components/CachedMedia'
import Pagination from '../components/Pagination'
import { swrQuery, makeKey, FRESH_SHORT, FRESH_LONG } from '../lib/dataCache'
import './ToolsPage.css'

/**
 * v5.5 — PERUBAHAN BESAR DI HALAMAN INI
 *
 * 1. Pagination di sisi server.
 *    Dulu halaman ini mengambil SELURUH baris `projects` yang published
 *    sekaligus (tanpa .limit()), lalu memfilter kategori di browser.
 *    Artinya: makin banyak tool, makin besar egress tiap kali halaman dibuka,
 *    padahal user cuma melihat belasan kartu pertama. Sekarang hanya 12 baris
 *    per halaman yang diminta lewat .range(), dan filter kategori dikerjakan
 *    database.
 *
 * 2. Hasil tiap halaman disimpan di device (dataCache).
 *    Bolak-balik antar halaman atau kembali dari halaman detail tidak
 *    memicu request baru selama 5 menit.
 *
 * 3. Thumbnail video tidak lagi <video autoPlay> polos.
 *    CardMedia baru mengunduh video setelah kartunya masuk layar, lalu
 *    menyimpannya di IndexedDB supaya kunjungan berikutnya nol byte.
 */

const PAGE_SIZE = 12

const PROJECT_COLUMNS =
  'id,title,thumbnail_url,aspect_ratio,content_type,category_id,sort_order,categories(name,icon,slug)'

export default function ToolsPage() {
  const [projects, setProjects] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [searchParams, setSearchParams] = useSearchParams()
  const activeCategoryParam = searchParams.get('category') || 'all'
  const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)

  const navigate = useNavigate()

  /* ── 1. Kategori: jarang berubah, disimpan lama di device ───────── */
  useEffect(() => {
    let alive = true

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
      {
        freshMs: FRESH_LONG,
        onRevalidated: (fresh) => { if (alive) setCategories(fresh) },
      },
    )
      .then(({ data }) => { if (alive) setCategories(data || []) })
      .catch(() => { /* tanpa kategori halaman tetap jalan */ })

    return () => { alive = false }
  }, [])

  /**
   * Home mengirim `?category=<uuid>`, chip di halaman ini mengirim
   * `?category=<slug>`. Keduanya harus tetap bekerja, jadi nilainya
   * diterjemahkan dulu ke category_id sebelum dikirim ke database.
   */
  const resolvedCategoryId = useMemo(() => {
    if (activeCategoryParam === 'all') return null
    const found = categories.find(
      (c) => c.slug === activeCategoryParam || c.id === activeCategoryParam,
    )
    return found ? found.id : activeCategoryParam
  }, [activeCategoryParam, categories])

  /* ── 2. Satu halaman project ────────────────────────────────────── */
  const fetchPage = useCallback(async () => {
    const from = (pageParam - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('projects')
      .select(PROJECT_COLUMNS, { count: 'exact' })
      .eq('is_published', true)

    if (resolvedCategoryId) query = query.eq('category_id', resolvedCategoryId)

    const { data, error, count } = await query
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error
    return { rows: data || [], count: count || 0 }
  }, [pageParam, resolvedCategoryId])

  useEffect(() => {
    // Tunggu kategori selesai dimuat kalau URL memakai slug, supaya tidak
    // sempat mengirim satu query dengan filter yang salah.
    const needsCategories = activeCategoryParam !== 'all' && categories.length === 0
    if (needsCategories) return

    let alive = true
    setLoading(true)
    setLoadError('')

    const key = makeKey('tools', {
      cat: resolvedCategoryId || 'all',
      page: pageParam,
      size: PAGE_SIZE,
    })

    swrQuery(key, fetchPage, {
      freshMs: FRESH_SHORT,
      onRevalidated: (fresh) => {
        if (!alive) return
        setProjects(fresh.rows)
        setTotalCount(fresh.count)
      },
    })
      .then(({ data }) => {
        if (!alive) return
        setProjects(data.rows)
        setTotalCount(data.count)
        setLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        setLoadError(err.message || 'Gagal memuat data')
        setLoading(false)
      })

    return () => { alive = false }
  }, [fetchPage, resolvedCategoryId, pageParam, activeCategoryParam, categories.length])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  /* ── 3. Navigasi ────────────────────────────────────────────────── */
  function selectCategory(value) {
    // Ganti kategori selalu kembali ke halaman 1.
    if (!value || value === 'all') setSearchParams({})
    else setSearchParams({ category: value })
  }

  function goToPage(next) {
    const params = {}
    if (activeCategoryParam !== 'all') params.category = activeCategoryParam
    if (next > 1) params.page = String(next)
    setSearchParams(params)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="tools-page animate-fadeIn">
      <div className="tools-header">
        <h1 className="page-title">Tools Prompt</h1>
        <p className="page-subtitle">Koleksi generator video dan prompt teks</p>
      </div>

      {/* FILTER KATEGORI */}
      <div className="filter-scroll">
        <button
          className={`filter-chip ${activeCategoryParam === 'all' ? 'active' : ''}`}
          onClick={() => selectCategory('all')}
        >
          Semua
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`filter-chip ${activeCategoryParam === (cat.slug || cat.id) || activeCategoryParam === cat.id ? 'active' : ''}`}
            onClick={() => selectCategory(cat.slug || cat.id)}
          >
            {cat.icon?.startsWith('http') ? (
              <img src={cat.icon} alt={cat.name} loading="lazy" style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }} />
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
          {Array(PAGE_SIZE).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ paddingTop: '133%', borderRadius: 12 }} />
          ))}
        </div>
      ) : loadError ? (
        <div className="empty-tools">
          <Search size={40} className="empty-icon" />
          <h3>Gagal memuat</h3>
          <p>{loadError}</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-tools">
          <Search size={40} className="empty-icon" />
          <h3>Tidak ada konten</h3>
          <p>Belum ada tool atau prompt di kategori ini.</p>
        </div>
      ) : (
        <>
          <div className="tools-grid">
            {projects.map(proj => (
              <div
                key={proj.id}
                className={`tool-card card-interactive ratio-${(proj.aspect_ratio || '9:16').replace(':', '')}`}
                onClick={() => navigate(`/tools/${proj.id}`)}
              >
                <CardMedia url={proj.thumbnail_url} alt={proj.title} className="card-bg" />

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

          <Pagination
            page={pageParam}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
            onChange={goToPage}
            disabled={loading}
          />
        </>
      )}
    </div>
  )
}
