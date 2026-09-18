// ============================================================
// Edge Function: admin-create-user
// Deploy via Supabase CLI: supabase functions deploy admin-create-user
// Atau paste ke Supabase Dashboard > Edge Functions
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify caller JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Token tidak ditemukan' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Client dengan JWT caller (untuk cek role/permission)
    const supabaseCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    
    // Client dengan service role (untuk admin operations)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // 2. Verify caller identity
    const { data: { user: caller }, error: authError } = await supabaseCaller.auth.getUser()
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'User tidak terverifikasi' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Get caller profile & permissions
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (!callerProfile) {
      return new Response(JSON.stringify({ error: 'Profil tidak ditemukan' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const callerRole = callerProfile.role

    // 4. Check permission
    let canCreateUsers = false
    if (callerRole === 'architect') {
      canCreateUsers = true
    } else if (callerRole === 'admin') {
      const { data: perms } = await supabaseAdmin
        .from('admin_permissions')
        .select('can_manage_users')
        .eq('user_id', caller.id)
        .single()
      canCreateUsers = perms?.can_manage_users === true
    }

    if (!canCreateUsers) {
      return new Response(JSON.stringify({ error: 'Tidak punya izin membuat user' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 5. Parse request body
    const { email, password, display_name, role: targetRole = 'member' } = await req.json()

    if (!email || !password || !display_name) {
      return new Response(JSON.stringify({ error: 'Email, password, dan nama wajib diisi' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password minimal 6 karakter' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 6. Role restriction
    const validRoles = ['member', 'admin', 'architect']
    if (!validRoles.includes(targetRole)) {
      return new Response(JSON.stringify({ error: 'Role tidak valid' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Admin biasa HANYA boleh create member
    if (callerRole === 'admin' && targetRole !== 'member') {
      return new Response(JSON.stringify({ error: 'Admin hanya boleh membuat akun member' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Warning: architect membuat architect lain
    // (tetap diizinkan tapi dicatat)

    // 7. Create user via admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        display_name,
      }
    })

    if (createError) {
      return new Response(JSON.stringify({ error: `Gagal membuat user: ${createError.message}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 8. Update profile role (trigger sudah buat profile dengan role 'member')
    if (targetRole !== 'member') {
      await supabaseAdmin
        .from('profiles')
        .update({ role: targetRole, display_name })
        .eq('id', newUser.user.id)
    } else {
      // Pastikan display_name tersimpan
      await supabaseAdmin
        .from('profiles')
        .update({ display_name })
        .eq('id', newUser.user.id)
    }

    // 9. Jika role = admin, buat row admin_permissions (default false)
    if (targetRole === 'admin') {
      await supabaseAdmin
        .from('admin_permissions')
        .insert({ user_id: newUser.user.id })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Akun ${targetRole} berhasil dibuat untuk ${email}`,
      user_id: newUser.user.id,
      temporary_password: password, // Tampil sekali saja
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: `Server error: ${err.message}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
