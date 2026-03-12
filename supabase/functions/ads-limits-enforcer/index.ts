import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const internalSecret = req.headers.get('x-internal-secret')
    if (internalSecret !== Deno.env.get('INTERNAL_TIER_SECRET')) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { deviceIdHash, platform, username, tier, ipAddress } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: burstData, error: burstError } = await supabase
      .from('usage_events')
      .select('id')
      .eq('device_id_hash', deviceIdHash)
      .eq('username_analyzed', username)
      .gte('created_at', new Date(Date.now() - 60000).toISOString())
      .limit(1)

    if (burstError) throw burstError
    if (burstData && burstData.length > 0) {
      return new Response(JSON.stringify({ allow: false, retryAfterSeconds: 60, reason: 'burst_lock' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (tier === 'free') {
      const { data: windowData, error: windowError } = await supabase
        .from('usage_events')
        .select('id')
        .eq('device_id_hash', deviceIdHash)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      if (windowError) throw windowError
      if (windowData && windowData.length >= 3) {
        return new Response(JSON.stringify({ allow: false, retryAfterSeconds: 3600, reason: 'daily_limit' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const { error: insertError } = await supabase
      .from('usage_events')
      .insert({
        device_id_hash: deviceIdHash,
        platform,
        username_analyzed: username,
        tier,
        ip_address: ipAddress
      })

    if (insertError) throw insertError

    return new Response(
      JSON.stringify({ allow: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
