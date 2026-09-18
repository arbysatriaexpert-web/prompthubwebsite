import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSettings, SiteLogo } from '../../contexts/SettingsContext'
import { Loader2 } from 'lucide-react'
import './LoginPage.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const { settings } = useSettings()
  const waNumber = settings?.whatsapp_number || ''
  const siteName = settings?.site_name || 'PromptHub'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      navigate('/')
    } catch (err) {
      setError('Email atau password salah. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-glow" />
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo">
          <SiteLogo className="login-logo-icon" />
          <h1 className="login-logo-text">{siteName}</h1>
        </div>
        <p className="login-subtitle">Masuk ke akun kamu untuk akses semua prompt & tools AI.</p>

        {error && <div className="login-error">{error}</div>}

        <div className="field-group">
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" placeholder="nama@email.com"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" placeholder="Masukkan password"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <button type="submit" className="btn btn-primary btn-lg login-submit" disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : 'Login'}
        </button>

        <p className="login-footer">
          Belum punya akun?{' '}
          {waNumber ? (
            <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer">
              Hubungi admin via WA →
            </a>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>Hubungi admin</span>
          )}
        </p>
      </form>
    </div>
  )
}
