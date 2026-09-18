import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { X } from 'lucide-react'

/**
 * PopupBanner — menampilkan banner aktif sesuai mode yang dipilih admin.
 *
 * display_mode:
 *   'once'        -> sekali seumur akun. Setelah ditutup, tidak muncul lagi.
 *   'every_login' -> muncul lagi setiap kali user login / buka sesi baru.
 *   'daily'       -> maksimal sekali per hari (perilaku lama, jadi default).
 *
 * Penanda 'every_login' disimpan di sessionStorage supaya otomatis hilang
 * saat tab ditutup atau user logout, sedangkan 'once' dan 'daily' disimpan
 * di localStorage dan dikunci per user id agar tidak bocor antar akun
 * yang login di perangkat yang sama.
 */
export default function PopupBanner() {
  const { user } = useAuth()
  const [banner, setBanner] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (user) checkAndShow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  function seenKey(b) {
    const uid = user?.id || 'anon'
    const mode = b.display_mode || 'daily'
    if (mode === 'once') return `popup_once_${uid}_${b.id}`
    if (mode === 'every_login') return `popup_session_${uid}_${b.id}`
    return `popup_daily_${uid}_${b.id}_${new Date().toISOString().slice(0, 10)}`
  }

  function storageFor(b) {
    return (b.display_mode === 'every_login') ? sessionStorage : localStorage
  }

  function alreadySeen(b) {
    try {
      return !!storageFor(b).getItem(seenKey(b))
    } catch {
      return false
    }
  }

  async function checkAndShow() {
    const { data: settings } = await supabase
      .from('site_settings').select('popup_enabled').eq('id', 1).maybeSingle()
    if (!settings || settings.popup_enabled === false) return

    const now = new Date().toISOString()
    const { data: banners } = await supabase
      .from('popup_banners')
      .select('id,title,message,image_url,link_url,button_label,display_mode,sort_order')
      .eq('is_active', true)
      .or(`start_at.is.null,start_at.lte.${now}`)
      .or(`end_at.is.null,end_at.gte.${now}`)
      .order('sort_order', { ascending: true })
      .limit(5)

    if (!banners || banners.length === 0) return

    const next = banners.find(b => !alreadySeen(b))
    if (!next) return

    setBanner(next)
    setVisible(true)
  }

  function handleClose() {
    if (banner) {
      try {
        storageFor(banner).setItem(seenKey(banner), '1')
      } catch {
        /* storage penuh atau diblokir — abaikan saja */
      }
    }
    setVisible(false)
  }

  if (!visible || !banner) return null

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '20px',
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{
        background: 'var(--bg-card, #1a1a2e)',
        borderRadius: '16px',
        maxWidth: '400px', width: '100%',
        maxHeight: 'calc(100dvh - 80px)',
        overflowY: 'auto',
        position: 'relative',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        animation: 'slideUp 0.3s ease',
      }}>
        <button onClick={handleClose} aria-label="Tutup" style={{
          position: 'absolute', top: '10px', right: '10px',
          background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%',
          width: '32px', height: '32px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', color: '#fff', zIndex: 2,
        }}>
          <X size={16} />
        </button>

        {banner.image_url && (
          <img src={banner.image_url} alt={banner.title}
            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} />
        )}

        <div style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-white, #fff)', marginBottom: '8px' }}>
            {banner.title}
          </h3>

          {banner.message && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted, #999)', lineHeight: 1.6, marginBottom: '16px' }}>
              {banner.message}
            </p>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            {banner.link_url && (
              <a href={banner.link_url} target="_blank" rel="noopener noreferrer" onClick={handleClose}
                style={{
                  flex: 1, padding: '10px',
                  background: 'var(--accent, #6366f1)', color: '#fff',
                  borderRadius: '10px', textAlign: 'center', textDecoration: 'none',
                  fontSize: '13px', fontWeight: 600,
                }}>
                {banner.button_label || 'Lihat Selengkapnya'}
              </a>
            )}
            <button onClick={handleClose} style={{
              flex: banner.link_url ? 0 : 1, padding: '10px 20px',
              background: 'var(--bg-surface, #2a2a3e)', color: 'var(--text-muted, #999)',
              border: '1px solid var(--border-subtle, #333)', borderRadius: '10px',
              fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              Tutup
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  )
}
