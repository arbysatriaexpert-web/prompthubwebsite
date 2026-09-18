import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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

  const refreshSettings = useCallback(async () => {
    // maybeSingle() -> tidak melempar error kalau row id=1 belum ada
    const { data } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    setSettings(data || null)
    setLoading(false)
  }, [])

  useEffect(() => { refreshSettings() }, [refreshSettings])

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
