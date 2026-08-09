import { NextResponse } from "next/server"
import { fetchQuiverDataset } from "@/lib/quiver"

/**
 * Federal money trail — E-8g.
 *
 * Government contract awards and lobbying spend, per ticker, from the two
 * Quiver datasets the plan actually includes (probe 2026-08-08). Both answer
 * the same question from opposite ends: money the government pays a company,
 * and money a company spends on the government.
 *
 * DISPLAY ONLY, never scored. Both feeds are reported with a lag measured in
 * weeks-to-quarters — contract awards post after the fact, lobbying is filed
 * quarterly — so they cannot lead a drawdown and the E-6 lead-time rule bars
 * them from CCPI weight. They are context for a position, not a canary.
 *
 * Honesty: a dollar total is the sum of what the feed actually returned within
 * the window, never an extrapolation, and `windowTruncated` says plainly when
 * the 20k-row feed ceiling means older records exist that we did not see.
 */

export const dynamic = "force-dynamic"

interface ContractRow {
  date: string
  agency: string
  description: string
  amountUsd: number
}

interface LobbyingRow {
  date: string
  client: string
  registrant: string
  issue: string
  specificIssue: string
  amountUsd: number
}

/** Quiver sends amounts as strings ("1234567.00") and occasionally blank. */
function money(raw: unknown): number | null {
  const n = Number.parseFloat(String(raw ?? "").replace(/[$,]/g, ""))
  return Number.isFinite(n) ? n : null
}

function isoDay(raw: unknown): string | null {
  const s = String(raw ?? "").slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ticker = (url.searchParams.get("ticker") || "").toUpperCase().trim()
  const days = Math.min(1825, Math.max(30, Number.parseInt(url.searchParams.get("days") || "365", 10) || 365))

  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker parameter" }, { status: 400 })
  }

  const cutoffMs = Date.now() - days * 86400000

  const [contractsResult, lobbyingResult] = await Promise.all([
    fetchQuiverDataset("govcontracts", "/api/federal-money", "Government contract data"),
    fetchQuiverDataset("lobbying", "/api/federal-money", "Lobbying data"),
  ])

  // Either feed may fail on its own. A failed feed reports null (not zero) and
  // its own message — "no contracts found" and "we could not ask" are different
  // facts and the UI must be able to tell them apart.
  let contracts: ContractRow[] | null = null
  let contractsError: string | null = null
  let contractsFeedRows = 0
  if (contractsResult.ok) {
    contractsFeedRows = contractsResult.data.length
    contracts = (contractsResult.data as Record<string, unknown>[])
      .filter((r) => String(r.Ticker ?? "").toUpperCase() === ticker)
      .map((r) => {
        const date = isoDay(r.Date) ?? isoDay(r.action_date)
        const amountUsd = money(r.Amount)
        return date && amountUsd !== null
          ? {
              date,
              agency: String(r.Agency ?? "—"),
              description: String(r.Description ?? "—"),
              amountUsd,
            }
          : null
      })
      .filter((r): r is ContractRow => r !== null && new Date(r.date).getTime() >= cutoffMs)
      .sort((a, b) => b.date.localeCompare(a.date))
  } else {
    contractsError = contractsResult.message
  }

  let lobbying: LobbyingRow[] | null = null
  let lobbyingError: string | null = null
  let lobbyingFeedRows = 0
  if (lobbyingResult.ok) {
    lobbyingFeedRows = lobbyingResult.data.length
    lobbying = (lobbyingResult.data as Record<string, unknown>[])
      .filter((r) => String(r.Ticker ?? "").toUpperCase() === ticker)
      .map((r) => {
        const date = isoDay(r.Date)
        const amountUsd = money(r.Amount)
        return date && amountUsd !== null
          ? {
              date,
              client: String(r.Client ?? "—"),
              registrant: String(r.Registrant ?? "—"),
              issue: String(r.Issue ?? "—"),
              specificIssue: String(r.Specific_Issue ?? "—"),
              amountUsd,
            }
          : null
      })
      .filter((r): r is LobbyingRow => r !== null && new Date(r.date).getTime() >= cutoffMs)
      .sort((a, b) => b.date.localeCompare(a.date))
  } else {
    lobbyingError = lobbyingResult.message
  }

  // Both feeds cap at 20,000 rows. When a feed comes back at the cap, its
  // oldest row is a horizon, not a beginning — so a window reaching past it is
  // reported as truncated rather than as a complete history.
  const FEED_CAP = 20000
  const oldest = (rows: { date: string }[] | null) => (rows && rows.length > 0 ? rows[rows.length - 1].date : null)

  if (!contractsResult.ok && !lobbyingResult.ok) {
    // Nothing to show and nothing to imply — surface the upstream failure with
    // a real error status rather than an empty 200 that reads as "no activity".
    return NextResponse.json(
      {
        success: false,
        ticker,
        contractsError,
        lobbyingError,
        message: "Neither federal-money feed could be read.",
      },
      { status: contractsResult.httpStatus },
    )
  }

  return NextResponse.json({
    success: true,
    source: "Quiver Quant (licensed API)",
    ticker,
    windowDays: days,
    scored: false,
    scoringNote:
      "Display only. Contract awards and lobbying filings are reported weeks to quarters after the fact, " +
      "so neither can lead a drawdown and neither carries CCPI weight.",
    contracts: contracts
      ? {
          count: contracts.length,
          totalUsd: contracts.reduce((a, r) => a + r.amountUsd, 0),
          oldestSeen: oldest(contracts),
          windowTruncated: contractsFeedRows >= FEED_CAP,
          rows: contracts.slice(0, 100),
        }
      : null,
    lobbying: lobbying
      ? {
          count: lobbying.length,
          totalUsd: lobbying.reduce((a, r) => a + r.amountUsd, 0),
          oldestSeen: oldest(lobbying),
          windowTruncated: lobbyingFeedRows >= FEED_CAP,
          rows: lobbying.slice(0, 100),
        }
      : null,
    contractsError,
    lobbyingError,
  })
}
