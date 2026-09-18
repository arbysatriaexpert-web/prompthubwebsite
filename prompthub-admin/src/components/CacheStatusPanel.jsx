import { useCallback, useEffect, useState } from 'react'
import {
  getCacheStats,
  clearMediaCache,
  pruneExpired,
  requestPersistentStorage,
} from '../lib/mediaCache'
import { getDataCacheStats, clearDataCache } from '../lib/dataCache'
import { formatBytes } from '../lib/uploadLimits'

/**
 * CacheStatusPanel — PromptHub v5.5
 *
 * Jawaban yang bisa dilihat langsung untuk pertanyaan "cache-nya benar-benar
 * tersimpan di device saya atau tidak, dan berapa lama".
 *
 * Yang ditampilkan:
 *  - Status penyimpanan permanen (navigator.storage.persisted). Kalau true,
 *    browser tidak akan membuang cache situs ini waktu disk menipis.
 *  - Jumlah dan total ukuran file media yang tersimpan, plus tanggal
 *    kedaluwarsanya per file.
 *  - Ukuran cache data (hasil query tabel) beserta waktu penyimpanannya.
 *
 * Verifikasi tandingan tanpa panel ini:
 *  F12 → Application → IndexedDB → prompthub-cache → media
 *  F12 → Network → muat ulang: file media tidak muncul lagi di daftar request.
 */

function fmtDate(ms) {
  if (!ms) return '—'
  try {
    return new Date(ms).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function daysLeft(ms) {
  if (!ms) return '—'
  const d = Math.ceil((ms - Date.now()) / 86400000)
  return d > 0 ? `${d} hari lagi` : 'kedaluwarsa'
}

export default function CacheStatusPanel({ onToast }) {
  const [stats, setStats] = useState(null)
  const [dataStats, setDataStats] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showList, setShowList] = useState(false)

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const [m, d] = await Promise.all([getCacheStats(), getDataCacheStats()])
      setStats(m)
      setDataStats(d)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  function toast(msg, type = 'success') {
    if (typeof onToast === 'function') onToast(msg, type)
  }

  async function handlePersist() {
    const ok = await requestPersistentStorage()
    toast(
      ok
        ? 'Penyimpanan situs ini sekarang permanen di device kamu.'
        : 'Browser belum memberi izin permanen. Coba bookmark panel ini atau pasang sebagai aplikasi, lalu ulangi.',
      ok ? 'success' : 'info',
    )
    refresh()
  }

  async function handlePrune() {
    const n = await pruneExpired()
    toast(`${n} file kedaluwarsa dibuang.`)
    refresh()
  }

  async function handleClearMedia() {
    if (!confirm('Hapus semua file media yang tersimpan di device ini? Media akan diunduh ulang saat dibuka lagi.')) return
    await clearMediaCache()
    toast('Cache media dikosongkan.')
    refresh()
  }

  async function handleClearData() {
    if (!confirm('Hapus cache daftar (project, artikel, kategori)? Data akan diambil ulang dari Supabase.')) return
    await clearDataCache()
    toast('Cache data dikosongkan.')
    refresh()
  }

  const rows = [
    { label: 'Penyimpanan permanen', value: stats?.persisted ? '✅ Ya' : '⚠️ Belum' },
    { label: 'File media tersimpan', value: `${stats?.mediaCount || 0} file` },
    { label: 'Ukuran cache media', value: formatBytes(stats?.mediaBytes || 0) },
    { label: 'File tertua disimpan', value: fmtDate(stats?.oldestStoredAt) },
    { label: 'File terbaru disimpan', value: fmtDate(stats?.newestStoredAt) },
    { label: 'Cache daftar data', value: `${dataStats?.count || 0} entri · ${formatBytes(dataStats?.approxBytes || 0)}` },
    {
      label: 'Terpakai dari kuota browser',
      value: stats?.quotaBytes
        ? `${formatBytes(stats.usageBytes)} dari ${formatBytes(stats.quotaBytes)}`
        : '—',
    },
  ]

  return (
    <div className="crud-form card" style={{ marginTop: 16 }}>
      <h3 className="crud-form-title">💾 Cache di Device Ini</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
        Media dan daftar data disimpan di browser ini supaya panel tidak
        mengunduh ulang dari Supabase setiap kali dibuka. Umur simpan media
        satu tahun; daftar data disegarkan otomatis beberapa menit sekali.
      </p>

      <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
        {rows.map(r => (
          <div
            key={r.label}
            style={{
              display: 'flex', justifyContent: 'space-between', gap: 12,
              fontSize: 12, padding: '6px 10px', borderRadius: 8,
              background: 'var(--bg-dark, rgba(0,0,0,0.2))',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
            <strong style={{ color: 'var(--text-primary)' }}>{r.value}</strong>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={busy}>🔄 Muat ulang</button>
        {!stats?.persisted && (
          <button className="btn btn-primary btn-sm" onClick={handlePersist}>📌 Jadikan permanen</button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={handlePrune} disabled={busy}>🧹 Buang yang kedaluwarsa</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowList(v => !v)}>
          {showList ? 'Sembunyikan daftar' : '📄 Lihat daftar file'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handleClearData}>Hapus cache data</button>
        <button className="btn btn-ghost btn-sm" onClick={handleClearMedia}>Hapus cache media</button>
      </div>

      {showList && (
        <div style={{ marginTop: 14, maxHeight: 280, overflowY: 'auto' }}>
          {(stats?.items || []).length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum ada file tersimpan.</p>
          ) : (
            stats.items.slice(0, 50).map(it => (
              <div
                key={it.key}
                style={{
                  fontSize: 11, padding: '6px 0',
                  borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.07))',
                }}
              >
                <div style={{
                  color: 'var(--text-primary)', wordBreak: 'break-all',
                  fontFamily: 'ui-monospace, monospace',
                }}>
                  {it.key.split('/').slice(-2).join('/')}
                </div>
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                  {formatBytes(it.size)} · disimpan {fmtDate(it.storedAt)} · {daysLeft(it.expiresAt)} · dipakai {it.hits}×
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
