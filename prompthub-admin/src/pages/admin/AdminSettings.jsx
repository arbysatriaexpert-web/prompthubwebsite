import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/Toast'
import { useSettings } from '../../contexts/SettingsContext'
import { Save } from 'lucide-react'
import MediaUploadField from '../../components/MediaUploadField'
import CacheStatusPanel from '../../components/CacheStatusPanel'
import './AdminCrud.css'

export default function AdminSettings() {
  const { toast } = useToast()
  const { refreshSettings } = useSettings()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    site_name: 'PromptHub',
    whatsapp_number: '',
    contact_email: '',
    logo_url: '',
    feedback_enabled: true,
    popup_enabled: true,
  })

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    setLoading(true)
    const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
    if (error) toast(`Gagal memuat pengaturan: ${error.message}`, 'error', 6000)
    if (data) {
      setForm({
        site_name: data.site_name || 'PromptHub',
        whatsapp_number: data.whatsapp_number || '',
        contact_email: data.contact_email || '',
        logo_url: data.logo_url || '',
        feedback_enabled: data.feedback_enabled !== false,
        popup_enabled: data.popup_enabled !== false,
      })
    }
    setLoading(false)
  }

  // v5.5 — upload ditangani <MediaUploadField>. cacheControl juga dinaikkan
  // dari 3600 (1 jam) ke 31536000 (1 tahun): logo ikut diunduh di SETIAP
  // halaman oleh setiap pengunjung, jadi ini pos egress yang paling sering.

  async function handleSave() {
    setSaving(true)

    const { error } = await supabase.from('site_settings').upsert({
      id: 1,
      site_name: form.site_name,
      whatsapp_number: form.whatsapp_number,
      contact_email: form.contact_email,
      logo_url: form.logo_url,
      feedback_enabled: form.feedback_enabled,
      popup_enabled: form.popup_enabled,
      updated_at: new Date().toISOString(),
    })

    setSaving(false)

    if (error) {
      const hint = error.code === '42501' || /row-level security/i.test(error.message || '')
        ? '\n\nRLS memblokir. Jalankan supabase_patch_v5.2.sql.'
        : ''
      return toast(`Gagal menyimpan: ${error.message}${hint}`, 'error', 9000)
    }

    toast('Pengaturan berhasil disimpan', 'success')
    // FIX: refresh context supaya logo di sidebar langsung berubah tanpa reload
    await refreshSettings()
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">⚙️ Pengaturan Website</h1>
      </div>

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Memuat...</p> : (
        <>
          {/* Branding */}
          <div className="crud-form card">
            <h3 className="crud-form-title">🎨 Branding</h3>

            <div className="field-group">
              <label className="field-label">Nama Website</label>
              <input className="input" value={form.site_name}
                onChange={e => setForm({ ...form, site_name: e.target.value })}
                placeholder="PromptHub" />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Tampil di sebelah logo pada navbar admin & web user.
              </p>
            </div>

            <div className="field-group">
              <MediaUploadField
                label="Logo Website (rasio 1:1 / persegi)"
                value={form.logo_url}
                folder="thumbnails"
                prefix="logo_"
                accept="image/*"
                kind="image"
                previewHeight={90}
                maxWidth={512}
                onUploaded={url => setForm(prev => ({ ...prev, logo_url: url }))}
                onRemove={() => setForm(prev => ({ ...prev, logo_url: '' }))}
                onError={msg => toast(msg, 'error', 8000)}
                onSuccess={() => toast('Logo terupload. Jangan lupa tekan Simpan.', 'info', 5000)}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Setelah disimpan, logo otomatis dipakai di sidebar admin, halaman login, dan navbar web user.
              </p>
            </div>
          </div>

          {/* Kontak Admin */}
          <div className="crud-form card" style={{ marginTop: 16 }}>
            <h3 className="crud-form-title">📞 Kontak Admin</h3>
            <div className="crud-form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field-group">
                <label className="field-label">Nomor WhatsApp</label>
                <input className="input" value={form.whatsapp_number}
                  onChange={e => setForm({ ...form, whatsapp_number: e.target.value })}
                  placeholder="Contoh: 6281234567890 (gunakan awalan 62)" />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Dipakai tombol Hubungi Admin di website.
                </p>
              </div>
              <div className="field-group">
                <label className="field-label">Email Kontak (opsional)</label>
                <input className="input" type="email" value={form.contact_email}
                  onChange={e => setForm({ ...form, contact_email: e.target.value })}
                  placeholder="admin@prompthub.com" />
              </div>
            </div>
          </div>

          {/* Toggle Emergency */}
          <div className="crud-form card" style={{ marginTop: 16 }}>
            <h3 className="crud-form-title">🚨 Toggle Fitur (Emergency)</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Nonaktifkan fitur secara instan jika terjadi masalah atau spam.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'feedback_enabled', title: '📩 Fitur Masukan / Feedback',
                  on: 'User bisa mengirim request, bug report, dan feedback.',
                  off: 'Fitur masukan dinonaktifkan. Form disabled di web user.' },
                { key: 'popup_enabled', title: '🎯 Popup Banner',
                  on: 'Popup banner aktif ditampilkan ke user setelah login.',
                  off: 'Semua popup dinonaktifkan.' },
              ].map(t => (
                <div key={t.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 10,
                  background: form[t.key] ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${form[t.key] ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-white)' }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {form[t.key] ? t.on : t.off}
                    </div>
                  </div>
                  <div className={`toggle ${form[t.key] ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, [t.key]: !form[t.key] })}
                    style={{ flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>

          {/* v5.5 — status cache di device admin ini sendiri */}
          <CacheStatusPanel onToast={(msg, type) => toast(msg, type || 'success', 5000)} />

          {/* Action bar menempel di bawah supaya tombol simpan selalu terjangkau */}
          <div style={{
            position: 'sticky', bottom: 0, marginTop: 16, padding: '12px 0',
            background: 'linear-gradient(to top, var(--bg-darkest, #0b0b12) 60%, transparent)',
          }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : <><Save size={16} /> Simpan Pengaturan</>}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
