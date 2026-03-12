import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { analyzeGames } from './engine.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id, x-internal-tier, x-internal-secret',
}

async function hashSHA256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

async function hmacSHA256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function determineTier(req: Request): string {
  const internalTier = req.headers.get('x-internal-tier');
  const internalSecret = req.headers.get('x-internal-secret');
  const expectedSecret = Deno.env.get('INTERNAL_TIER_SECRET');
  
  if (internalSecret && expectedSecret && internalSecret === expectedSecret) {
    if (internalTier === 'pro' || internalTier === 'elite') {
      return internalTier;
    }
  }
  return 'free';
}

async function runAnalysisPipeline(cacheKey: string, platform: string, username: string, maxGames: number, tier: string, algoVersion: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    await supabase.from('jobs').update({ progress: 'fetch' }).eq('cache_key', cacheKey)

    const proxyRes = await fetch(`${supabaseUrl}/functions/v1/proxy-chess-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ platform, username, maxGames })
    })

    if (!proxyRes.ok) {
      throw new Error('Failed to fetch games')
    }

    const { data: games } = await proxyRes.json()
    
    await supabase.from('jobs').update({ progress: 'parse' }).eq('cache_key', cacheKey)

    const result = analyzeGames(games, username, platform, tier)

    if (result.error) {
      throw new Error(result.error)
    }

    await supabase.from('jobs').update({ progress: 'finalize' }).eq('cache_key', cacheKey)

    const now = new Date()
    const freshHours = tier === 'elite' ? 3 : 6
    const staleHours = 24
    
    const freshTTL = freshHours * 60 * 60 * 1000
    const staleTTL = staleHours * 60 * 60 * 1000

    await supabase.from('analysis_cache').upsert({
      cache_key: cacheKey,
      tier,
      algo_version: algoVersion,
      status: 'ready',
      result,
      expires_at: new Date(now.getTime() + freshTTL).toISOString(),
      stale_expires_at: new Date(now.getTime() + staleTTL).toISOString(),
      updated_at: now.toISOString()
    })

    await supabase.from('jobs').update({ status: 'done', progress: 'done', updated_at: now.toISOString() }).eq('cache_key', cacheKey)

  } catch (error: any) {
    console.error('Pipeline error:', error)
    await supabase.from('jobs').update({ status: 'failed', progress: 'failed', updated_at: new Date().toISOString() }).eq('cache_key', cacheKey)
    await supabase.from('analysis_cache').upsert({
      cache_key: cacheKey,
      tier,
      algo_version: algoVersion,
      status: 'failed',
      result: { error: error.message },
      expires_at: new Date().toISOString(),
      stale_expires_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    throw error
  }
}

serve(async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseKey)

  if (req.method === 'GET') {
    try {
      const url = new URL(req.url)
      const cacheKey = url.searchParams.get('cacheKey')
      if (!cacheKey) throw new Error('Missing cacheKey')

      const { data: cacheData } = await supabase
        .from('analysis_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .single()

      const { data: jobData } = await supabase
        .from('jobs')
        .select('*')
        .eq('cache_key', cacheKey)
        .in('status', ['pending', 'processing'])
        .single()

      if (jobData) {
        const now = Date.now()
        const jobUpdated = new Date(jobData.updated_at).getTime()
        const isStale = (now - jobUpdated) > 120000

        if (jobData.status === 'pending' || isStale) {
          const { data: updatedJob } = await supabase
            .from('jobs')
            .update({ status: 'processing', updated_at: new Date(now).toISOString() })
            .eq('id', jobData.id)
            .in('status', [jobData.status])
            .select()
            .single()

          if (updatedJob) {
            const platform = url.searchParams.get('platform')
            const input = url.searchParams.get('input')
            const maxGamesStr = url.searchParams.get('maxGames')
            
            if (platform && input && maxGamesStr) {
              let username = input.trim().toLowerCase()
              if (username.includes('lichess.org/@/')) {
                username = username.split('lichess.org/@/')[1].split('/')[0]
              } else if (username.includes('chess.com/member/')) {
                username = username.split('chess.com/member/')[1].split('/')[0]
              }
              const maxGames = parseInt(maxGamesStr, 10)
              const tier = determineTier(req)
              const algoVersion = 'v1'

              try {
                await runAnalysisPipeline(cacheKey, platform, username, maxGames, tier, algoVersion)
                
                const { data: finalCache } = await supabase.from('analysis_cache').select('*').eq('cache_key', cacheKey).single()
                if (finalCache && finalCache.status === 'ready') {
                  return new Response(JSON.stringify({ status: 'ready', data: finalCache.result, tier: finalCache.tier }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                } else if (finalCache && finalCache.status === 'failed') {
                  return new Response(JSON.stringify({ status: 'failed', error: finalCache.result?.error || 'Analysis failed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                }
              } catch (err: any) {
                return new Response(JSON.stringify({ status: 'failed', error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
              }
            }
          }
        }
        
        return new Response(JSON.stringify({ status: 'queued', progress: jobData.progress }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (cacheData && cacheData.status === 'ready') {
        return new Response(JSON.stringify({ status: 'ready', data: cacheData.result, tier: cacheData.tier }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (cacheData && cacheData.status === 'failed') {
        return new Response(JSON.stringify({ status: 'failed', error: cacheData.result?.error || 'Analysis failed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      return new Response(JSON.stringify({ status: 'failed', error: 'Job not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }
  }

  try {
    const { platform, input, filters } = await req.json()
    const deviceId = req.headers.get('x-device-id') || 'unknown'
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1'

    let username = input.trim().toLowerCase()
    if (username.includes('lichess.org/@/')) {
      username = username.split('lichess.org/@/')[1].split('/')[0]
    } else if (username.includes('chess.com/member/')) {
      username = username.split('chess.com/member/')[1].split('/')[0]
    }

    const salt = Deno.env.get('DEVICE_HASH_SALT') || 'default_salt'
    const deviceIdHash = await hashSHA256(deviceId + salt)

    const tier = determineTier(req)

    const enforcerRes = await fetch(`${supabaseUrl}/functions/v1/ads-limits-enforcer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'x-internal-secret': Deno.env.get('INTERNAL_TIER_SECRET') || ''
      },
      body: JSON.stringify({ deviceIdHash, platform, username, tier, ipAddress })
    })

    if (!enforcerRes.ok) {
      const err = await enforcerRes.json()
      return new Response(JSON.stringify(err), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const enforcerData = await enforcerRes.json()
    if (!enforcerData.allow) {
      return new Response(JSON.stringify(enforcerData), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const algoVersion = 'v1'
    const maxGames = tier === 'elite' ? 2000 : tier === 'pro' ? 2000 : 300
    const cacheString = `${platform}|${username}|${maxGames}|${filters?.timeClass || 'all'}|${filters?.color || 'all'}|${filters?.dateRange || 'all'}|${algoVersion}|${tier}`
    const cacheSecret = Deno.env.get('CACHE_HMAC_SECRET') || 'default_cache_secret'
    const cacheKey = await hmacSHA256(cacheSecret, cacheString)

    const { data: cacheData } = await supabase
      .from('analysis_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .single()

    const now = new Date()
    let isStale = false

    if (cacheData && cacheData.status === 'ready') {
      const expiresAt = new Date(cacheData.expires_at)
      const staleExpiresAt = new Date(cacheData.stale_expires_at)

      if (now < expiresAt) {
        return new Response(JSON.stringify({ status: 'ready', data: cacheData.result, tier }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      } else if (now < staleExpiresAt) {
        isStale = true
      }
    }

    const { error: jobError } = await supabase.from('jobs').insert({
      cache_key: cacheKey,
      status: 'pending',
      progress: 'fetch',
      priority: tier === 'elite' ? 1 : tier === 'pro' ? 2 : 3
    })

    if (jobError) {
      const { data: existingJob } = await supabase.from('jobs').select('*').eq('cache_key', cacheKey).single()
      if (existingJob && ['pending', 'processing'].includes(existingJob.status)) {
        const isStaleJob = (Date.now() - new Date(existingJob.updated_at).getTime()) > 120000
        if (isStaleJob) {
          await supabase.from('jobs').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', existingJob.id)
        }
      }
    }

    if (isStale) {
      return new Response(JSON.stringify({ status: 'ready', data: cacheData.result, tier, refreshing: true, cacheKey }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ status: 'queued', cacheKey, tier }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
