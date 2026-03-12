import { Chess } from 'https://esm.sh/chess.js@1.0.0-beta.6'

export interface Evidence {
  percentage: number;
  n: number;
  ruleUsed: string;
  confidence: 'High' | 'Medium' | 'Low';
  exampleGames: string[];
}

export interface Weakness {
  title: string;
  description: string;
  evidence: Evidence;
}

export interface PlanStep {
  point: string;
  evidence: Evidence | null;
  warning?: string;
}

export interface ProcessedGame {
  isWhite: boolean;
  isBlack: boolean;
  isWin: boolean;
  isLoss: boolean;
  isDraw: boolean;
  eco: string;
  movesCount: number;
  castledBefore10: boolean;
  pgnStr: string;
}

export function analyzeGames(games: any[], username: string, platform: string, tier: string) {
  const targetUser = username.toLowerCase()
  let wins = 0, losses = 0, draws = 0
  let totalMovesWin = 0, totalMovesLoss = 0
  let fastCollapse = 0
  let castledBefore10Win = 0, castledBefore10Loss = 0, castledBefore10Total = 0
  let lossPhase = { opening: 0, mid: 0, end: 0 }
  
  const openings: Record<string, { count: number, wins: number, losses: number, draws: number }> = {}
  const defenses: Record<string, { count: number, wins: number, losses: number, draws: number }> = {}
  
  const maxExamples = tier === 'elite' ? 18 : tier === 'pro' ? 12 : 6
  const fastCollapseExamples: string[] = []
  const endgameLossExamples: string[] = []
  const generalExamples: string[] = []

  const processedGames: ProcessedGame[] = []

  for (const g of games) {
    try {
      let whitePlayer, blackPlayer, result, pgn, eco, movesCount = 0
      
      if (platform === 'lichess') {
        whitePlayer = g.players?.white?.user?.name?.toLowerCase()
        blackPlayer = g.players?.black?.user?.name?.toLowerCase()
        result = g.status === 'draw' ? 'draw' : (g.winner === 'white' ? 'white' : 'black')
        pgn = g.moves
        eco = g.opening?.eco || 'Unknown'
        movesCount = pgn ? pgn.split(' ').length : 0
      } else {
        whitePlayer = g.white?.username?.toLowerCase()
        blackPlayer = g.black?.username?.toLowerCase()
        const resW = g.white?.result
        const resB = g.black?.result
        result = (resW === 'win') ? 'white' : (resB === 'win') ? 'black' : 'draw'
        pgn = g.pgn
        eco = 'Unknown'
        if (pgn) {
          const ecoMatch = pgn.match(/\[ECO "([^"]+)"\]/)
          if (ecoMatch) eco = ecoMatch[1]
        }
      }

      const isWhite = whitePlayer === targetUser
      const isBlack = blackPlayer === targetUser
      if (!isWhite && !isBlack) continue

      const isWin = (isWhite && result === 'white') || (isBlack && result === 'black')
      const isLoss = (isWhite && result === 'black') || (isBlack && result === 'white')
      const isDraw = result === 'draw'

      if (isWin) wins++
      if (isLoss) losses++
      if (isDraw) draws++

      let chess
      let castledBefore10 = false
      let pgnStr = ''
      if (pgn) {
        chess = new Chess()
        if (platform === 'lichess') {
          const moves = pgn.split(' ')
          for (let i = 0; i < moves.length; i++) {
            chess.move(moves[i])
            if (i < 20) {
              const history = chess.history()
              if (history.length > 0 && (history[history.length-1] === 'O-O' || history[history.length-1] === 'O-O-O')) {
                if ((isWhite && i % 2 === 0) || (isBlack && i % 2 === 1)) {
                  castledBefore10 = true
                }
              }
            }
          }
          movesCount = Math.floor(moves.length / 2)
        } else {
          chess.loadPgn(pgn)
          movesCount = Math.floor(chess.history().length / 2)
          const history = chess.history()
          for (let i = 0; i < Math.min(20, history.length); i++) {
            if (history[i] === 'O-O' || history[i] === 'O-O-O') {
              if ((isWhite && i % 2 === 0) || (isBlack && i % 2 === 1)) {
                castledBefore10 = true
              }
            }
          }
        }
        
        pgnStr = platform === 'lichess' ? pgn : chess.pgn()
        if (isLoss && movesCount <= 20) fastCollapseExamples.push(pgnStr)
        else if (isLoss && movesCount > 40) endgameLossExamples.push(pgnStr)
        else generalExamples.push(pgnStr)
      }

      if (isWin) totalMovesWin += movesCount
      if (isLoss) {
        totalMovesLoss += movesCount
        if (movesCount <= 20) fastCollapse++
        
        if (movesCount <= 15) lossPhase.opening++
        else if (movesCount <= 40) lossPhase.mid++
        else lossPhase.end++
      }

      if (castledBefore10) {
        castledBefore10Total++
        if (isWin) castledBefore10Win++
        if (isLoss) castledBefore10Loss++
      }

      if (isWhite) {
        if (!openings[eco]) openings[eco] = { count: 0, wins: 0, losses: 0, draws: 0 }
        openings[eco].count++
        if (isWin) openings[eco].wins++
        if (isLoss) openings[eco].losses++
        if (isDraw) openings[eco].draws++
      } else {
        if (!defenses[eco]) defenses[eco] = { count: 0, wins: 0, losses: 0, draws: 0 }
        defenses[eco].count++
        if (isWin) defenses[eco].wins++
        if (isLoss) defenses[eco].losses++
        if (isDraw) defenses[eco].draws++
      }

      processedGames.push({ isWhite, isBlack, isWin, isLoss, isDraw, eco, movesCount, castledBefore10, pgnStr })
    } catch (e) {
      // Ignore parsing errors for individual games
    }
  }

  const totalGames = wins + losses + draws
  if (totalGames < 10) {
    return { error: 'Not enough games analyzed (n < 10). Please play more games or adjust filters.' }
  }

  const avgMovesWin = wins > 0 ? Math.round(totalMovesWin / wins) : null
  const avgMovesLoss = losses > 0 ? Math.round(totalMovesLoss / losses) : null
  const fastCollapseRate = losses > 0 ? Math.round((fastCollapse / losses) * 100) : null

  const weaknesses: Weakness[] = []
  const plans: { asWhite: PlanStep[], asBlack: PlanStep[] } = { asWhite: [], asBlack: [] }

  if (fastCollapseRate !== null && fastCollapseRate > 20 && fastCollapse >= 3) {
    weaknesses.push({
      title: 'Early Game Instability',
      description: 'Opponent frequently loses within the first 20 moves.',
      evidence: {
        percentage: fastCollapseRate,
        n: fastCollapse,
        ruleUsed: 'fastCollapseRate > 20% AND n >= 3',
        confidence: fastCollapse >= 10 ? 'High' : 'Medium',
        exampleGames: fastCollapseExamples.slice(0, 3)
      }
    })
    const planPoint = `Apply early tactical pressure. Opponent collapses in <=20 moves in ${fastCollapseRate}% of their losses.`
    plans.asWhite.push({ point: planPoint, evidence: weaknesses[weaknesses.length - 1].evidence })
    plans.asBlack.push({ point: planPoint, evidence: weaknesses[weaknesses.length - 1].evidence })
  }

  const endgameLossRate = losses > 0 ? Math.round((lossPhase.end / losses) * 100) : null
  if (endgameLossRate !== null && lossPhase.end > lossPhase.mid && lossPhase.end > lossPhase.opening && lossPhase.end >= 3) {
    weaknesses.push({
      title: 'Endgame Vulnerability',
      description: 'Opponent loses a disproportionate number of games that reach move 40+.',
      evidence: {
        percentage: endgameLossRate,
        n: lossPhase.end,
        ruleUsed: 'lossPhase.end > mid AND opening AND n >= 3',
        confidence: lossPhase.end >= 10 ? 'High' : 'Medium',
        exampleGames: endgameLossExamples.slice(0, 3)
      }
    })
    const planPoint = `Steer towards the endgame. Opponent loses ${endgameLossRate}% of their lost games after move 40.`
    plans.asWhite.push({ point: planPoint, evidence: weaknesses[weaknesses.length - 1].evidence })
    plans.asBlack.push({ point: planPoint, evidence: weaknesses[weaknesses.length - 1].evidence })
  }

  if (plans.asWhite.length === 0) {
    plans.asWhite.push({ point: 'Insufficient evidence to formulate a specific white plan.', evidence: null, warning: 'n < threshold for all plan rules' })
  }
  if (plans.asBlack.length === 0) {
    plans.asBlack.push({ point: 'Insufficient evidence to formulate a specific black plan.', evidence: null, warning: 'n < threshold for all plan rules' })
  }

  const allExamples = [
    ...fastCollapseExamples.map(pgn => ({ pgn, reason: 'Evidence: Early Game Instability (Loss <= 20 moves)' })),
    ...endgameLossExamples.map(pgn => ({ pgn, reason: 'Evidence: Endgame Vulnerability (Loss > 40 moves)' })),
    ...generalExamples.map(pgn => ({ pgn, reason: 'General Reference Game' }))
  ].slice(0, maxExamples)

  // PRO MODULES IMPLEMENTATION
  let trendShiftModule: any = { error: 'Insufficient data for Trend Shift. Requires n >= 40 games.' }
  let matchupPacksModule: any = { error: 'No significant matchup vulnerabilities found (n >= 10, loss rate > 60%).' }

  if (processedGames.length >= 40) {
    const half = Math.floor(processedGames.length / 2)
    const recentGames = processedGames.slice(0, half)
    const olderGames = processedGames.slice(half)

    const recentLosses = recentGames.filter(g => g.isLoss)
    const olderLosses = olderGames.filter(g => g.isLoss)

    const recentFastCollapse = recentLosses.filter(g => g.movesCount <= 20).length
    const olderFastCollapse = olderLosses.filter(g => g.movesCount <= 20).length

    const recentFastCollapseRate = recentLosses.length > 0 ? recentFastCollapse / recentLosses.length : 0
    const olderFastCollapseRate = olderLosses.length > 0 ? olderFastCollapse / olderLosses.length : 0

    const trendExamples: { pgn: string, reason: string }[] = []

    if (recentLosses.length >= 10 && olderLosses.length >= 10) {
      if (recentFastCollapseRate - olderFastCollapseRate > 0.15) {
        const recentFastCollapsePgns = recentLosses.filter(g => g.movesCount <= 20).map(g => g.pgnStr)
        trendExamples.push(...recentFastCollapsePgns.slice(0, 3).map(pgn => ({ pgn, reason: `Trend Shift: Recent increase in early collapses (${Math.round(recentFastCollapseRate * 100)}% vs ${Math.round(olderFastCollapseRate * 100)}% historically)` })))
      } else if (olderFastCollapseRate - recentFastCollapseRate > 0.15) {
        const recentLongLossPgns = recentLosses.filter(g => g.movesCount > 20).map(g => g.pgnStr)
        trendExamples.push(...recentLongLossPgns.slice(0, 3).map(pgn => ({ pgn, reason: `Trend Shift: Recent improvement in early survival, games are going longer (${Math.round(recentFastCollapseRate * 100)}% early collapse vs ${Math.round(olderFastCollapseRate * 100)}% historically)` })))
      }
    }

    const getTopOpening = (gamesList: ProcessedGame[], isWhite: boolean) => {
      const filtered = gamesList.filter(g => isWhite ? g.isWhite : g.isBlack)
      const counts: Record<string, number> = {}
      for (const g of filtered) counts[g.eco] = (counts[g.eco] || 0) + 1
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
      return sorted.length > 0 ? sorted[0] : null
    }

    const recentTopWhite = getTopOpening(recentGames, true)
    const olderTopWhite = getTopOpening(olderGames, true)

    if (recentTopWhite && olderTopWhite && recentTopWhite[0] !== olderTopWhite[0] && recentTopWhite[1] >= 10 && olderTopWhite[1] >= 10) {
      const recentWhitePgns = recentGames.filter(g => g.isWhite && g.eco === recentTopWhite[0]).map(g => g.pgnStr)
      trendExamples.push(...recentWhitePgns.slice(0, 3).map(pgn => ({ pgn, reason: `Trend Shift: Recently switched to playing ${recentTopWhite[0]} as White (previously preferred ${olderTopWhite[0]})` })))
    }

    if (trendExamples.length > 0) {
      trendShiftModule = { examples: trendExamples.slice(0, maxExamples) }
    } else {
      trendShiftModule = { error: 'No statistically significant trend shifts detected in the current dataset.' }
    }
  }

  const openingStats: Record<string, { count: number, losses: number, pgns: string[] }> = {}
  for (const g of processedGames) {
    if (!openingStats[g.eco]) openingStats[g.eco] = { count: 0, losses: 0, pgns: [] }
    openingStats[g.eco].count++
    if (g.isLoss) {
      openingStats[g.eco].losses++
      openingStats[g.eco].pgns.push(g.pgnStr)
    }
  }
  
  const vulnerableOpenings = Object.entries(openingStats)
    .filter(([eco, stats]) => stats.count >= 10 && (stats.losses / stats.count) > 0.6)
    .sort((a, b) => (b[1].losses / b[1].count) - (a[1].losses / a[1].count))

  if (vulnerableOpenings.length > 0) {
    const packExamples: { pgn: string, reason: string }[] = []
    for (const [eco, stats] of vulnerableOpenings.slice(0, 3)) {
      const lossRate = Math.round((stats.losses / stats.count) * 100)
      packExamples.push(...stats.pgns.slice(0, 2).map(pgn => ({ pgn, reason: `Matchup Pack: Vulnerable in ECO ${eco} (Loss rate: ${lossRate}%, n=${stats.count})` })))
    }
    matchupPacksModule = { examples: packExamples.slice(0, maxExamples) }
  }

  // PRESSURE MAP IMPLEMENTATION
  let pressureMapModule: any = { error: 'Insufficient data for Pressure Map. Requires n >= 30 losses.' }
  const totalLosses = processedGames.filter(g => g.isLoss)
  if (totalLosses.length >= 30) {
    const buckets = {
      'Opening (1-15 moves)': 0,
      'Early Midgame (16-25 moves)': 0,
      'Late Midgame (26-35 moves)': 0,
      'Endgame (36+ moves)': 0
    }
    const bucketPgns: Record<string, string[]> = {
      'Opening (1-15 moves)': [],
      'Early Midgame (16-25 moves)': [],
      'Late Midgame (26-35 moves)': [],
      'Endgame (36+ moves)': []
    }

    for (const g of totalLosses) {
      let bucket = ''
      if (g.movesCount <= 15) bucket = 'Opening (1-15 moves)'
      else if (g.movesCount <= 25) bucket = 'Early Midgame (16-25 moves)'
      else if (g.movesCount <= 35) bucket = 'Late Midgame (26-35 moves)'
      else bucket = 'Endgame (36+ moves)'
      
      buckets[bucket as keyof typeof buckets]++
      bucketPgns[bucket].push(g.pgnStr)
    }

    const pressureExamples: { pgn: string, reason: string }[] = []
    for (const [bucket, count] of Object.entries(buckets)) {
      const percentage = count / totalLosses.length
      if (count >= 10 && percentage >= 0.4) {
        pressureExamples.push(...bucketPgns[bucket].slice(0, 3).map(pgn => ({
          pgn,
          reason: `Pressure Map: High concentration of losses in ${bucket} (${Math.round(percentage * 100)}% of all losses, n=${count}). Clock data not parsed, using phase-clustering.`
        })))
      }
    }

    if (pressureExamples.length > 0) {
      pressureMapModule = { examples: pressureExamples.slice(0, maxExamples) }
    } else {
      pressureMapModule = { error: 'Losses are evenly distributed across game phases. No specific pressure zone detected (requires >= 40% concentration and n >= 10).' }
    }
  }

  // ANTI-PREP IMPLEMENTATION
  let antiPrepModule: any = { error: 'Insufficient data for Anti-Prep. Requires n >= 20 games as a specific color.' }
  
  const whiteGames = processedGames.filter(g => g.isWhite)
  const blackGames = processedGames.filter(g => g.isBlack)
  
  const antiPrepExamples: { pgn: string, reason: string }[] = []

  const checkAntiPrep = (gamesList: ProcessedGame[], color: string) => {
    if (gamesList.length < 20) return
    const ecoCounts: Record<string, { count: number, pgns: string[] }> = {}
    for (const g of gamesList) {
      if (!ecoCounts[g.eco]) ecoCounts[g.eco] = { count: 0, pgns: [] }
      ecoCounts[g.eco].count++
      ecoCounts[g.eco].pgns.push(g.pgnStr)
    }
    
    // Find highly repeated opening (e.g., > 30% of games as this color, n >= 10)
    for (const [eco, data] of Object.entries(ecoCounts)) {
      const percentage = data.count / gamesList.length
      if (data.count >= 10 && percentage >= 0.3) {
        antiPrepExamples.push(...data.pgns.slice(0, 2).map(pgn => ({
          pgn,
          reason: `Anti-Prep: Opponent heavily relies on ECO ${eco} as ${color} (${Math.round(percentage * 100)}% frequency, n=${data.count}). Prepare specific deviations.`
        })))
      }
    }
  }

  checkAntiPrep(whiteGames, 'White')
  checkAntiPrep(blackGames, 'Black')

  if (whiteGames.length >= 20 || blackGames.length >= 20) {
    if (antiPrepExamples.length > 0) {
      antiPrepModule = { examples: antiPrepExamples.slice(0, maxExamples) }
    } else {
      antiPrepModule = { error: 'Opponent has a highly varied repertoire. No single opening meets the predictability threshold (>= 30% frequency, n >= 10).' }
    }
  }

  const proModules = {
    trendShift: trendShiftModule,
    pressureMap: pressureMapModule,
    antiPrep: antiPrepModule,
    matchupPacks: matchupPacksModule
  }

  return {
    profile: {
      totalGames,
      wins, losses, draws,
      metrics: {
        avgMovesWin,
        avgMovesLoss,
        fastCollapseRate,
        castledBefore10Win,
        castledBefore10Loss,
        phaseLossDistribution: lossPhase
      },
      openings: Object.entries(openings).sort((a, b) => b[1].count - a[1].count).slice(0, 5),
      defenses: Object.entries(defenses).sort((a, b) => b[1].count - a[1].count).slice(0, 5)
    },
    weaknesses,
    plans,
    examples: allExamples,
    proModules
  }
}
