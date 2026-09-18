import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { swrQuery, dropCache, FRESH_LONG } from '../lib/dataCache'

/**
 * v5.5 — site_settings disimpan di device admin. Isinya hampir tidak pernah
 * berubah, jadi hanya disegarkan tiap 6 jam. refreshSettings() memaksa ambil
 * ulang dan dipanggil AdminSettings tepat setelah menyimpan, sehingga panel
 * tidak pernah menampilkan data lama.
 */
const SETTINGS_KEY = 'site_settings:full'

const SettingsContext = createContext({
  settings: null,
  loading: true,
  refreshSettings: () => {},
})

export function useSettings() {
  return useContext(SettingsContext)
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (force = false) => {
    try {
      if (force) await dropCache(SETTINGS_KEY)
      const { data } = await swrQuery(
        SETTINGS_KEY,
        async () => {
          // maybeSingle() -> tidak melempar error kalau row id=1 belum ada
          const { data, error } = await supabase
            .from('site_settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle()
          if (error) throw error
          return data || null
        },
        { freshMs: force ? 0 : FRESH_LONG, force, onRevalidated: (d) => setSettings(d || null) },
      )
      setSettings(data || null)
    } catch {
      setSettings(null)
    }
    setLoading(false)
  }, [])

  const refreshSettings = useCallback(() => load(true), [load])

  useEffect(() => { load(false) }, [load])

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

/**
 * Komponen logo yang dipakai di seluruh aplikasi.
 * Kalau logo_url ada di site_settings -> render gambar.
 * Kalau kosong -> fallback huruf pertama site_name (default "P").
 */
export function SiteLogo({ className = 'logo-icon', size }) {
  const { settings } = useSettings()
  const name = settings?.site_name || 'PromptHub'
  const style = size ? { width: size, height: size } : undefined

  if (settings?.logo_url) {
    return (
      <img
        src={settings.logo_url}
        alt={name}
        className={className}
        style={{ objectFit: 'cover', ...style }}
      />
    )
  }
  return <div className={className} style={style}>{name.charAt(0).toUpperCase()}</div>
}

export function SiteName({ className }) {
  const { settings } = useSettings()
  return <span className={className}>{settings?.site_name || 'PromptHub'}</span>
}
