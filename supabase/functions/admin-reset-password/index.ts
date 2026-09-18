// ============================================================
// Edge Function: admin-reset-password
// Deploy via Supabase CLI: supabase functions deploy admin-reset-password
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Token tidak ditemukan' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Verify caller
    const { data: { user: caller }, error: authError } = await supabaseCaller.auth.getUser()
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'User tidak terverifikasi' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get caller role
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

    // Check permission
    let canManageUsers = false
    if (callerRole === 'architect') {
      canManageUsers = true
    } else if (callerRole === 'admin') {
      const { data: perms } = await supabaseAdmin
        .from('admin_permissions')
        .select('can_manage_users')
        .eq('user_id', caller.id)
        .single()
      canManageUsers = perms?.can_manage_users === true
    }

    if (!canManageUsers) {
      return new Response(JSON.stringify({ error: 'Tidak punya izin reset password' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request
    const { user_id, new_password } = await req.json()

    if (!user_id || !new_password) {
      return new Response(JSON.stringify({ error: 'user_id dan new_password wajib diisi' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (new_password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password minimal 6 karakter' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get target user role
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, display_name')
      .eq('id', user_id)
      .single()

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: 'User target tidak ditemukan' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Admin biasa TIDAK boleh reset architect
    if (callerRole === 'admin' && targetProfile.role === 'architect') {
      return new Response(JSON.stringify({ error: 'Admin tidak boleh mereset password Architect' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Admin biasa TIDAK boleh reset admin lain
    if (callerRole === 'admin' && targetProfile.role === 'admin') {
      return new Response(JSON.stringify({ error: 'Admin tidak boleh mereset password Admin lain' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Reset password
    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: new_password,
    })

    if (resetError) {
      return new Response(JSON.stringify({ error: `Gagal reset: ${resetError.message}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Password ${targetProfile.display_name} berhasil direset`,
      temporary_password: new_password,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: `Server error: ${err.message}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
