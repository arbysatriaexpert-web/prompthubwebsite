// ============================================================
// Edge Function: submit-feedback
// Deploy via Supabase CLI: supabase functions deploy submit-feedback
// ============================================================
// Validasi:
// - User harus login
// - site_settings.feedback_enabled harus ON
// - Limit 2 feedback per user per hari
// - Type harus valid (request/bug/glitch/feedback)
// - Upload: foto max 2MB, video max 5MB
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_TYPES = ['request', 'bug', 'glitch', 'feedback']
const MAX_PHOTO_SIZE = 2 * 1024 * 1024  // 2MB
const MAX_VIDEO_SIZE = 5 * 1024 * 1024  // 5MB
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_VIDEO_MIMES = ['video/mp4']
const DAILY_LIMIT = 2

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Silakan login terlebih dahulu' }), {
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
    const { data: { user }, error: authError } = await supabaseCaller.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'User tidak terverifikasi' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check feedback_enabled
    const { data: settings } = await supabaseAdmin
      .from('site_settings')
      .select('feedback_enabled')
      .single()

    if (settings && settings.feedback_enabled === false) {
      return new Response(JSON.stringify({ error: 'Fitur masukan sedang dinonaktifkan sementara oleh admin' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check daily limit
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count } = await supabaseAdmin
      .from('feedback_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString())

    if ((count || 0) >= DAILY_LIMIT) {
      return new Response(JSON.stringify({ 
        error: `Kamu sudah mencapai batas ${DAILY_LIMIT} masukan per hari. Coba lagi besok ya!` 
      }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    const { 
      message, 
      type = 'request', 
      reference_url, 
      project_id,
      attachment_base64,
      attachment_mime,
      attachment_filename
    } = await req.json()

    if (!message || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Pesan tidak boleh kosong' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (message.length > 2000) {
      return new Response(JSON.stringify({ error: 'Pesan maksimal 2000 karakter' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate type
    if (!VALID_TYPES.includes(type)) {
      return new Response(JSON.stringify({ error: `Tipe tidak valid. Pilih: ${VALID_TYPES.join(', ')}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let attachmentUrl = null
    let attachmentType = null

    // Handle file upload if provided
    if (attachment_base64 && attachment_mime && attachment_filename) {
      // Validate MIME type
      const isImage = ALLOWED_IMAGE_MIMES.includes(attachment_mime)
      const isVideo = ALLOWED_VIDEO_MIMES.includes(attachment_mime)

      if (!isImage && !isVideo) {
        return new Response(JSON.stringify({ 
          error: `Format file tidak didukung. Foto: JPEG/PNG/WebP. Video: MP4.` 
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Decode and check size
      const binaryString = atob(attachment_base64)
      const fileSize = binaryString.length

      if (isImage && fileSize > MAX_PHOTO_SIZE) {
        return new Response(JSON.stringify({ error: 'Ukuran foto maksimal 2MB' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (isVideo && fileSize > MAX_VIDEO_SIZE) {
        return new Response(JSON.stringify({ error: 'Ukuran video maksimal 5MB' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Convert to Uint8Array
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Upload to requests/{user_id}/
      const ext = attachment_filename.split('.').pop() || (isImage ? 'jpg' : 'mp4')
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
      const filePath = `requests/${user.id}/${filename}`

      const { error: uploadError } = await supabaseAdmin.storage
        .from('media')
        .upload(filePath, bytes, {
          contentType: attachment_mime,
          upsert: false,
        })

      if (uploadError) {
        return new Response(JSON.stringify({ error: `Gagal upload: ${uploadError.message}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      attachmentUrl = filePath
      attachmentType = isImage ? 'image' : 'video'
    }

    // Insert feedback
    const { data: feedback, error: insertError } = await supabaseAdmin
      .from('feedback_requests')
      .insert({
        user_id: user.id,
        message: message.trim(),
        type,
        reference_url: reference_url || null,
        project_id: project_id || null,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError) {
      return new Response(JSON.stringify({ error: `Gagal mengirim: ${insertError.message}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Masukan berhasil dikirim! Terima kasih.',
      feedback_id: feedback.id,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: `Server error: ${err.message}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
