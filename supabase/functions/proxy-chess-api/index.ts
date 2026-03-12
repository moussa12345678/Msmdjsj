import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function parsePgnToLichessFormat(pgnText: string) {
  const games = []
  const gameBlocks = pgnText.split(/\n\s*\n/)
  
  let currentGame: any = null
  
  for (const block of gameBlocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    
    if (trimmed.startsWith('[')) {
      currentGame = {
        players: {
          white: { user: { name: '' } },
          black: { user: { name: '' } }
        },
        opening: { eco: 'Unknown' },
        status: 'unknown',
        winner: undefined,
        moves: ''
      }
      
      const headerLines = trimmed.split('\n')
      for (const line of headerLines) {
        const match = line.match(/\[(\w+)\s+"([^"]+)"\]/)
        if (match) {
          const key = match[1]
          const val = match[2]
          if (key === 'White') currentGame.players.white.user.name = val
          if (key === 'Black') currentGame.players.black.user.name = val
          if (key === 'Result') {
            if (val === '1-0') {
              currentGame.winner = 'white'
              currentGame.status = 'mate'
            } else if (val === '0-1') {
              currentGame.winner = 'black'
              currentGame.status = 'mate'
            } else if (val === '1/2-1/2') {
              currentGame.status = 'draw'
            }
          }
          if (key === 'ECO') currentGame.opening.eco = val
        }
      }
    } else {
      if (currentGame) {
        let movesStr = trimmed
          .replace(/\{[^}]*\}/g, '')
          .replace(/\[%[^\]]*\]/g, '')
          .replace(/\d+\.+/g, '')
          .replace(/1-0|0-1|1\/2-1\/2|\*/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        currentGame.moves = movesStr
        games.push(currentGame)
        currentGame = null
      }
    }
  }
  return games
}

async function fetchLichessGames(username: string, maxGames: number) {
  const url = `https://lichess.org/api/games/user/${username}?max=${maxGames}&clocks=false&evals=false&opening=true`
  const res = await fetch(url, { headers: { 'Accept': 'application/x-ndjson, application/x-chess-pgn, text/plain' } })
  if (!res.ok) {
    if (res.status === 429) throw new Error('lichess_429')
    throw new Error(`Lichess error: ${res.status}`)
  }
  
  const contentType = res.headers.get('content-type') || ''
  const text = await res.text()
  
  if (contentType.includes('application/x-ndjson')) {
    const lines = text.split('\n').filter(l => l.trim().length > 0)
    return lines.map(l => JSON.parse(l))
  } else {
    return parsePgnToLichessFormat(text)
  }
}

async function fetchChesscomGames(username: string, maxGames: number) {
  const archivesRes = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`)
  if (!archivesRes.ok) throw new Error(`Chess.com error: ${archivesRes.status}`)
  const archivesData = await archivesRes.json()
  const archives = archivesData.archives || []
  
  let allGames: any[] = []
  // Serial fetch as requested
  for (let i = archives.length - 1; i >= 0; i--) {
    if (allGames.length >= maxGames) break
    const monthRes = await fetch(archives[i])
    if (!monthRes.ok) {
      if (monthRes.status === 429) throw new Error('chesscom_429')
      continue
    }
    const monthData = await monthRes.json()
    const games = monthData.games || []
    allGames = allGames.concat(games.reverse())
    // Small delay to respect rate limits
    await new Promise(r => setTimeout(r, 100))
  }
  return allGames.slice(0, maxGames)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { platform, username, maxGames = 500 } = await req.json()
    
    let games = []
    if (platform === 'lichess') {
      games = await fetchLichessGames(username, maxGames)
    } else if (platform === 'chesscom') {
      games = await fetchChesscomGames(username, maxGames)
    } else {
      throw new Error('Invalid platform')
    }
    
    return new Response(
      JSON.stringify({ data: games }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
