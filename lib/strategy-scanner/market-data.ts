/**
 * Measured inputs for /api/strategy-scanner: price, implied volatility,
 * earnings dates, company identity.
 *
 * Split out of `app/api/strategy-scanner/route.ts` (P6-13), which was 1,808
 * lines. Nothing here changed in the move except that `COMPANY_NAMES` — which
 * existed twice in that file, once inside `getCompanyProfile` and once beside
 * the butterfly generator, with identical contents both times — is now one
 * constant.
 *
 * EVERY function in this file returns null or an empty collection when the
 * value cannot be established. That is the route's oldest rule and the reason
 * most of these comments exist: the versions they replaced returned a frozen
 * price table, an IV derived from how many contracts matched a filter, and a
 * market cap of 0 that classified the ticker "small-cap".
 */
import { resolveApiKey } from "@/lib/api-keys"
import { meteredFetch } from "@/lib/metered-fetch"

// Resolved through lib/api-keys so the DISABLED_APIS kill switch and the
// alias-aware lookup apply to this route too (AUDIT_BACKLOG P1-12).
export const POLYGON_API_KEY = resolveApiKey("POLYGON_API_KEY")
export const FINNHUB_API_KEY = resolveApiKey("FINNHUB_API_KEY")

/**
 * Annualised risk-free rate for every Black-Scholes call in this route.
 *
 * Constant, and therefore an approximation — it is not read from the live curve.
 * Delta and probability are only mildly sensitive to r over the 30–400 day
 * horizons quoted here, but it IS an assumption, so it is surfaced in the
 * response as `assumptions.riskFreeRate` rather than buried.
 * TODO(Phase 3): source from FRED DGS3MO, which /api/cpi-inflation already reads.
 */
export const RISK_FREE_RATE = 0.045

/** How near the money a contract must be to count toward the ATM IV average. */
export const ATM_BAND = 0.05

/**
 * Display names for the tickers the scanners screen by default.
 *
 * A fallback for the label only — never for a number. `getCompanyProfile`
 * reaches for it when Finnhub is unavailable, and the generators use it to
 * render a row whose figures were all measured.
 */
export const COMPANY_NAMES: Record<string, string> = {
  SPY: "SPDR S&P 500 ETF",
  QQQ: "Invesco QQQ Trust",
  IWM: "iShares Russell 2000 ETF",
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  NVDA: "NVIDIA Corporation",
  TSLA: "Tesla, Inc.",
  AMD: "Advanced Micro Devices",
  META: "Meta Platforms, Inc.",
  AMZN: "Amazon.com, Inc.",
  GOOGL: "Alphabet Inc.",
  JPM: "JPMorgan Chase & Co.",
  COST: "Costco Wholesale Corporation",
  NFLX: "Netflix, Inc.",
}

/**
 * Previous close from Polygon.
 *
 * Returns null when the price cannot be established. Callers MUST skip the
 * ticker rather than substitute a placeholder: the previous implementation fell
 * back to a table of prices frozen at authoring time (SPY 595, NVDA 145, …) and
 * to a literal $100 for anything unlisted, then computed strikes, breakevens and
 * dollar returns off that invented price (AUDIT_BACKLOG P1-9).
 */
export async function getStockPrice(ticker: string): Promise<{ price: number; asOf: string } | null> {
  if (!POLYGON_API_KEY) return null
  try {
    const res = await meteredFetch("polygon", `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apiKey=${POLYGON_API_KEY}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000),
      routeTag: "strategy-scanner",
    })
    if (!res.ok) return null
    const data = await res.json()
    const bar = data.results?.[0]
    if (!bar || typeof bar.c !== "number" || bar.c <= 0) return null
    return { price: bar.c, asOf: new Date(bar.t ?? Date.now()).toISOString() }
  } catch {
    return null
  }
}

export interface IVSnapshot {
  /** ATM implied volatility as a DECIMAL — 0.28 means 28%. Measured, not guessed. */
  atmIV: number
  /** Contracts the average was taken over; a confidence signal for the UI. */
  sampleSize: number
  /** Expiry the IV was measured at, ISO date. */
  expiration: string
  /** Days to that expiry. */
  dte: number
}

/**
 * Real ATM implied volatility from Polygon's options snapshot.
 *
 * The previous implementation called `/v3/reference/options/contracts` — a
 * metadata endpoint carrying no volatility field at all — with `limit=5`, then
 * computed `IV = 30 + contracts.length * 2`, yielding one of {30,32,34,36,38}
 * according to how many contracts happened to match a strike filter, and
 * reported it as `isLive: true`. That number drove the credit, probability,
 * breakeven, IV skew, quality score and signal of six public tabs
 * (AUDIT_BACKLOG P1-1).
 *
 * This reads `implied_volatility` from the snapshot endpoint — the same one
 * app/api/polygon-proxy already uses for the Sell Put Scanner — and averages
 * contracts within ATM_BAND of the money at the nearest sensible expiry.
 *
 * Returns null when the chain is unavailable or carries no IV. There is
 * deliberately no fallback: there is no honest way to guess a stock's implied
 * volatility, so callers omit the row instead.
 */
export async function getIVData(ticker: string, price: number): Promise<IVSnapshot | null> {
  if (!POLYGON_API_KEY || !(price > 0)) return null
  try {
    // The expiry window must be in the QUERY, not just filtered after the fact:
    // the snapshot sorts nearest-expiry-first, and on option-dense tickers
    // (AAPL ≈ 200+ front-week call strikes) a 250-row page never reached the
    // 7-day-out expiries — the post-fetch filter then emptied the list and
    // every scanner row was withheld (found live on staging, 2026-08-07).
    const minExpiry = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10)
    const maxExpiry = new Date(Date.now() + 45 * 86400_000).toISOString().slice(0, 10)
    const res = await meteredFetch(
      "polygon",
      `https://api.polygon.io/v3/snapshot/options/${ticker}?contract_type=call&expiration_date.gte=${minExpiry}&expiration_date.lte=${maxExpiry}&limit=250&apiKey=${POLYGON_API_KEY}`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(10000), routeTag: "strategy-scanner" },
    )
    if (!res.ok) return null

    const data = await res.json()
    const contracts: any[] = data.results || []
    if (contracts.length === 0) return null

    // Nearest expiry at least a week out (belt-and-braces re-check of the query
    // window above). The front week's IV is noisy and is not representative of
    // the ~30-day horizon these scanners quote.
    const dated = contracts.filter((c) => (c.details?.expiration_date ?? "") >= minExpiry)
    if (dated.length === 0) return null
    const expiration: string = dated.reduce(
      (best: string, c: any) => (c.details.expiration_date < best ? c.details.expiration_date : best),
      dated[0].details.expiration_date as string,
    )

    const atm = dated.filter((c) => {
      if (c.details?.expiration_date !== expiration) return false
      const strike = Number(c.details?.strike_price)
      const iv = Number(c.implied_volatility)
      return Number.isFinite(strike) && Number.isFinite(iv) && iv > 0 && Math.abs(strike - price) / price <= ATM_BAND
    })
    if (atm.length === 0) return null

    const atmIV = atm.reduce((sum, c) => sum + Number(c.implied_volatility), 0) / atm.length
    if (!(atmIV > 0)) return null

    const dte = Math.max(1, Math.round((new Date(expiration).getTime() - Date.now()) / 86400_000))
    return { atmIV, sampleSize: atm.length, expiration, dte }
  } catch {
    return null
  }
}

// Fetch upcoming earnings from Finnhub
export async function getUpcomingEarnings(): Promise<any[]> {
  if (!FINNHUB_API_KEY) return []

  try {
    const today = new Date()
    const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
    const fromDate = today.toISOString().split("T")[0]
    const toDate = twoWeeksLater.toISOString().split("T")[0]

    const res = await meteredFetch(
      "finnhub",
      `https://finnhub.io/api/v1/calendar/earnings?from=${fromDate}&to=${toDate}&token=${FINNHUB_API_KEY}`,
      { next: { revalidate: 3600 }, routeTag: "strategy-scanner" },
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.earningsCalendar || []
  } catch {
    return []
  }
}

/**
 * Next earnings date per ticker, over the coming quarter.
 *
 * Replaces `Math.random() * 60 + 30` in the calendar-spread generator, which
 * drove a user-facing "Safe" / "Watch out" earnings-risk verdict
 * (AUDIT_BACKLOG P1-6). One batched call rather than one per ticker.
 *
 * Tickers absent from the map have no known earnings date — callers must render
 * "unknown", not "safe".
 */
export async function getEarningsDateMap(tickers: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!FINNHUB_API_KEY || tickers.length === 0) return map

  try {
    const from = new Date().toISOString().slice(0, 10)
    const to = new Date(Date.now() + 100 * 86400_000).toISOString().slice(0, 10)
    const res = await meteredFetch(
      "finnhub",
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_API_KEY}`,
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000), routeTag: "strategy-scanner" },
    )
    if (!res.ok) return map

    const data = await res.json()
    const wanted = new Set(tickers)
    for (const row of data.earningsCalendar ?? []) {
      if (!wanted.has(row.symbol) || !row.date) continue
      // Keep the earliest upcoming date per ticker.
      const existing = map.get(row.symbol)
      if (!existing || row.date < existing) map.set(row.symbol, row.date)
    }
    return map
  } catch {
    return map
  }
}

// Fetch company profile from Finnhub
export async function getCompanyProfile(ticker: string): Promise<{ name: string; marketCap: number | null }> {
  if (!FINNHUB_API_KEY) {
    return { name: COMPANY_NAMES[ticker] || ticker, marketCap: null }
  }

  try {
    const res = await meteredFetch("finnhub", `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`, {
      next: { revalidate: 86400 },
      routeTag: "strategy-scanner",
    })
    if (!res.ok) return { name: COMPANY_NAMES[ticker] || ticker, marketCap: null }
    const data = await res.json()
    return {
      name: data.name || COMPANY_NAMES[ticker] || ticker,
      // Unknown cap is null. `|| 0` classified the ticker "small-cap" below.
      marketCap: Number.isFinite(data.marketCapitalization) ? Number(data.marketCapitalization) : null,
    }
  } catch {
    return { name: COMPANY_NAMES[ticker] || ticker, marketCap: null }
  }
}
