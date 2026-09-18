/**
 * Script untuk membuat akun admin pertama.
 * Jalankan sekali saja dengan: node setup-admin.mjs
 */

const SUPABASE_URL = 'https://vuajgoecuxhfamrcykts.supabase.co'

// Masukkan Service Role Key dari Supabase Dashboard > Settings > API > service_role
const SERVICE_ROLE_KEY = 'PASTE_SERVICE_ROLE_KEY_DISINI'

// Data admin
const ADMIN_EMAIL = 'admin@prompthub.com'
const ADMIN_PASSWORD = 'Admin123!'
const ADMIN_NAME = 'Admin PromptHub'

async function createAdmin() {
  console.log('🔧 Membuat akun admin...')

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: ADMIN_NAME,
        role: 'admin',
      },
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    console.error('❌ Gagal:', data.message || data.msg || JSON.stringify(data))
    return
  }

  console.log('✅ Akun admin berhasil dibuat!')
  console.log(`   Email: ${ADMIN_EMAIL}`)
  console.log(`   Password: ${ADMIN_PASSWORD}`)
  console.log(`   User ID: ${data.id}`)
  console.log('')
  console.log('🔒 Segera ganti password setelah login pertama!')
}

createAdmin()
