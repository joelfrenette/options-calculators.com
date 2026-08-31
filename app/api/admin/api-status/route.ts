import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/auth"
import { API_KEY_ALIASES, hasRawKey, isServiceDisabled, resolveApiKey } from "@/lib/api-keys"
import { meteredFetch } from "@/lib/metered-fetch"

/**
 * Per-provider status for the admin APIs tab (AUDIT_BACKLOG A-11).
 *
 * Rules this route obeys, each one a defect the rebuild removed:
 *  1. Keys are resolved ONLY through lib/api-keys.ts (`resolveApiKey`,
 *     `hasRawKey`, `isServiceDisabled`). No `process.env` reads, no hand-rolled
 *     alias tables — a kill-switched provider (DISABLED_APIS) can never render
 *     as configured/healthy, which is what made SerpAPI show a green
 *     "✓ KEY SAVED" while switched off.
 *  2. Key presence is NEVER a health verdict. A provider that was not probed is
 *     `probed:false` / `status:"unknown"` and says so. There is no "online".
 *  3. A probe hits the endpoint the app ACTUALLY calls. Where the only endpoint
 *     the app uses costs money (billable actor run, scraper credit, LLM token,
 *     an outbound email) the provider is deliberately NOT probed and the message
 *     names that reason.
 *  4. HTTP 200 with an error body is a FAILURE (mirrors `errorShape` in
 *     lib/api-contracts.ts) — Alpha Vantage `{"Information": rate limit}` and
 *     TwelveData `{"code":429}` used to score healthy.
 *  5. `message` states the measured reason (status code, upstream text, timeout).
 *     No guessed diagnosis — the old route reported every non-2xx as
 *     "Invalid or expired API key".
 *  6. Probes go through `meteredFetch` so admin probing shows up in the cost
 *     ledger like every other outbound call.
 *
 * Admin-gated: the payload discloses which keys are configured.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 60

const ROUTE_TAG = "/api/admin/api-status"
const PROBE_TIMEOUT_MS = 8000

type ProviderStatus = "ok" | "error" | "disabled" | "unknown"

/** The contract the admin APIs tab renders. Every field is measured or stated. */
interface ProviderRow {
  id: string
  name: string
  /** A raw env var (any accepted alias) is present. Says nothing about health. */
  rawPresent: boolean
  /** Kill-switched via DISABLED_APIS. */
  disabled: boolean
  /** Which alias spelling actually resolved, or null. */
  resolvedVia: string | null
  /** False ⇒ no network request was made; `status` is a statement, not a measurement. */
  probed: boolean
  httpStatus: number | null
  status: ProviderStatus
  message: string
  /** The endpoint the app itself calls (no key material). */
  endpoint: string
  usedIn: string[]
}

interface ProviderSpec {
  /** Canonical lowercase provider tag — also the metering tag. */
  id: string
  name: string
  /** Canonical key name in API_KEY_ALIASES, or null for a keyless provider. */
  keyName: string | null
  /** The endpoint the app actually calls, for display. */
  endpoint: string
  usedIn: string[]
  /**
   * Probe URL builder for the endpoint the app really uses. Return null (or omit)
   * to declare the provider unprobeable; `noProbeReason` then explains why.
   */
  probeUrl?: (key: string) => string
  probeInit?: RequestInit
  noProbeReason?: string
  /** No code path in the repo consumes this provider, so a missing key is not a fault. */
  unused?: boolean
}

function isoDay(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return d.toISOString().slice(0, 10)
}

/** Reason text reused by every provider whose only call site spends money. */
const BILLABLE = (what: string) =>
  `not probed — the only endpoint the app calls (${what}) costs money on every request, so probing it would bill the account. Key presence only.`

const PROVIDERS: ProviderSpec[] = [
  // ------------------------------------------------ market & economic data
  {
    id: "polygon",
    name: "Polygon.io",
    keyName: "POLYGON_API_KEY",
    endpoint: "https://api.polygon.io/v2/aggs/ticker/{ticker}/prev",
    usedIn: ["Options calculators", "Wheel / strategy scanners", "CCPI price inputs"],
    probeUrl: (key) => `https://api.polygon.io/v2/aggs/ticker/SPY/prev?adjusted=true&apiKey=${key}`,
  },
  {
    id: "fred",
    name: "FRED (St. Louis Fed)",
    keyName: "FRED_API_KEY",
    endpoint: "https://api.stlouisfed.org/fred/series/observations",
    usedIn: ["CCPI macro pillar", "FOMC predictions", "CPI / inflation", "Panic-Euphoria"],
    probeUrl: (key) =>
      `https://api.stlouisfed.org/fred/series/observations?series_id=DFF&api_key=${key}&file_type=json&limit=1&sort_order=desc`,
  },
  // Twelve Data probe removed 2026-08-29 (admin audit): purged dead provider —
  // its indicator job is computed locally from Polygon OHLCV.
  {
    id: "fmp",
    name: "Financial Modeling Prep",
    keyName: "FMP_API_KEY",
    endpoint: "https://financialmodelingprep.com/stable/quote",
    usedIn: ["CCPI valuation inputs (S&P 500 P/E, P/S)", "Scanner fundamentals"],
    probeUrl: (key) => `https://financialmodelingprep.com/stable/quote?symbol=AAPL&apikey=${key}`,
  },
  {
    id: "alphavantage",
    name: "Alpha Vantage",
    keyName: "ALPHA_VANTAGE_API_KEY",
    endpoint: "https://www.alphavantage.co/query?function=GLOBAL_QUOTE",
    usedIn: ["CCPI mega-cap / semiconductor momentum quotes"],
    probeUrl: (key) => `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=SPY&apikey=${key}`,
  },
  {
    id: "finnhub",
    name: "Finnhub",
    keyName: "FINNHUB_API_KEY",
    endpoint: "https://finnhub.io/api/v1/calendar/earnings",
    usedIn: ["Earnings calendar", "Landmine check", "Strategy scanner", "Insider transactions"],
    // The app calls /calendar/earnings, /stock/insider-transactions and
    // /company-news. It never calls /v1/quote — probing that endpoint is what
    // made Finnhub render red while the health check reported it passing.
    probeUrl: (key) => `https://finnhub.io/api/v1/calendar/earnings?from=${isoDay(0)}&to=${isoDay(7)}&token=${key}`,
  },
  {
    id: "apify",
    name: "Apify",
    keyName: "APIFY_API_TOKEN",
    endpoint: "https://api.apify.com/v2/acts/{actor-id}/runs",
    usedIn: ["Yahoo Finance valuation scraping (CCPI)", "Sentiment sources"],
    noProbeReason: BILLABLE("starting an actor run"),
  },
  // ------------------------------------------------------ scraping & search
  {
    id: "scrapingbee",
    name: "ScrapingBee",
    keyName: "SCRAPINGBEE_API_KEY",
    endpoint: "https://app.scrapingbee.com/api/v1/",
    usedIn: ["Market sentiment scrapes", "Panic-Euphoria inputs", "Social sentiment"],
    noProbeReason: BILLABLE("a /api/v1/ scrape, which consumes credits"),
  },
  {
    id: "serper",
    name: "Serper.dev",
    keyName: "SERPER_API_KEY",
    endpoint: "https://google.serper.dev/search + /news",
    usedIn: ["Google Trends proxy", "Serper finance news", "Social sentiment"],
    noProbeReason: BILLABLE("a /search or /news query, which consumes a search credit"),
  },
  // SerpAPI entry removed 2026-08-29 (admin audit): purged dead provider — its
  // Google-Trends job migrated to Serper. Was previously kept only to flag the
  // registered-but-unused key; now the key itself is gone from lib/api-keys.ts.
  // ------------------------------------------------------------------ email
  {
    id: "resend",
    name: "Resend",
    keyName: "RESEND_API_KEY",
    endpoint: "https://api.resend.com/emails",
    usedIn: ["Password-reset email", "Budget-guard notifications"],
    noProbeReason: "not probed — the only Resend endpoint the app uses SENDS AN EMAIL. Key presence only.",
  },
  // ------------------------------------------------------- keyless upstreams
  {
    id: "cnn-dataviz",
    name: "CNN Fear & Greed (keyless)",
    keyName: null,
    endpoint: "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
    usedIn: ["CCPI Pillar 2 equity Fear & Greed"],
    probeUrl: () => "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
    probeInit: {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    },
  },
  // ------------------------------------------------------- AI / LLM providers
  // Every one of these is reached only through lib/ai-providers.ts, i.e. a
  // billable chat completion. None is probed. The AI tab renders the live
  // fallback chain (order, model, key presence) generated from providerConfigs.
  ...(
    [
      ["openrouter", "OpenRouter (free model)", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1/chat/completions"],
      ["groq", "Groq", "GROQ_API_KEY", "https://api.groq.com/openai/v1/chat/completions"],
      ["google", "Google Gemini", "GOOGLE_AI_API_KEY", "https://generativelanguage.googleapis.com/v1beta/models"],
      ["xai", "xAI (Grok)", "XAI_API_KEY", "https://api.x.ai/v1/chat/completions"],
      ["anthropic", "Anthropic Claude", "ANTHROPIC_API_KEY", "https://api.anthropic.com/v1/messages"],
      ["perplexity", "Perplexity", "PERPLEXITY_API_KEY", "https://api.perplexity.ai/chat/completions"],
    ] as const
  ).map(([id, name, keyName, endpoint]) => ({
    id,
    name,
    keyName,
    endpoint,
    usedIn: ["AI fallback chain (lib/ai-providers.ts)"],
    noProbeReason:
      "not probed — the only endpoint the app calls is a chat completion, which spends tokens. See the AI tab for the live fallback chain (order, model, key presence).",
  })),
]

function snippet(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

/** Never echo key material back into an admin payload or a log line. */
function redact(text: string, key: string): string {
  return key ? text.split(key).join("[redacted]") : text
}

/**
 * Returns the upstream's own error text when a 2xx body is actually an error,
 * else null. Same principle as `errorShape` in lib/api-contracts.ts: several
 * providers answer HTTP 200 with a failure in the body.
 */
function describeErrorBody(body: unknown): string | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null
  const o = body as Record<string, unknown>

  // Generic { error: "..." } (errorShape) and { error: { message } } (Apify).
  if (typeof o.error === "string" && o.error.length > 0) return o.error
  if (o.error && typeof o.error === "object") {
    const nested = o.error as Record<string, unknown>
    if (typeof nested.message === "string" && nested.message.length > 0) return nested.message
  }

  // Alpha Vantage answers 200 with Information / Note / Error Message.
  for (const field of ["Information", "Note", "Error Message", "error_message"]) {
    const value = o[field]
    if (typeof value === "string" && value.length > 0) return `${field}: ${value}`
  }

  // Twelve Data answers 200 with { code: 429, message, status: "error" }.
  const code = typeof o.code === "number" ? o.code : null
  const statusField = typeof o.status === "string" ? o.status.toUpperCase() : null
  const message = typeof o.message === "string" ? o.message : null
  if (code !== null && code >= 400) return `code ${code}${message ? `: ${message}` : ""}`
  if (statusField === "ERROR" || statusField === "NOT_AUTHORIZED") {
    return message ? `status ${statusField}: ${message}` : `status ${statusField}`
  }

  return null
}

async function evaluate(spec: ProviderSpec): Promise<ProviderRow> {
  const aliases = spec.keyName ? (API_KEY_ALIASES[spec.keyName] ?? [spec.keyName]) : []
  const rawPresent = spec.keyName ? hasRawKey(spec.keyName) : false
  const disabled = spec.keyName ? isServiceDisabled(spec.keyName) : false
  const key = spec.keyName ? resolveApiKey(spec.keyName) : ""
  // `resolveApiKey` returns "" for a kill-switched service, so the alias that
  // resolved is derived from the same helper rather than a second env read.
  const resolvedVia = key ? (aliases.find((alias) => resolveApiKey(alias) === key) ?? aliases[0] ?? null) : null

  const base = {
    id: spec.id,
    name: spec.name,
    rawPresent,
    disabled,
    resolvedVia,
    endpoint: spec.endpoint,
    usedIn: [...spec.usedIn],
  }

  // 1. Kill switch wins over everything, including a present key.
  if (disabled) {
    return {
      ...base,
      probed: false,
      httpStatus: null,
      status: "disabled",
      message: rawPresent
        ? `Kill-switched: ${spec.keyName} is listed in DISABLED_APIS, so resolveApiKey() returns "" and the app behaves as if unconfigured. The key is still set in the environment but is never used.`
        : `Kill-switched: ${spec.keyName} is listed in DISABLED_APIS (and no key is configured either).`,
    }
  }

  // 2. Key required but absent — a fact, not a health verdict. For a provider
  //    nothing in the repo calls, an absent key is not a fault: it stays
  //    "unknown" rather than reading as a broken integration.
  if (spec.keyName && !key) {
    return {
      ...base,
      probed: false,
      httpStatus: null,
      status: spec.unused ? "unknown" : "error",
      message: spec.unused
        ? `${spec.noProbeReason ?? "not probed — key presence only"} No key is configured either (accepted spellings: ${aliases.join(", ")}).`
        : `No key configured. Accepted env-var spellings: ${aliases.join(", ")}.`,
    }
  }

  // 3. Deliberately unprobed (billable or non-existent endpoint).
  if (!spec.probeUrl) {
    return {
      ...base,
      probed: false,
      httpStatus: null,
      status: "unknown",
      message: spec.noProbeReason ?? "not probed — key presence only",
    }
  }

  // 4. Real probe against the endpoint the app itself calls.
  let response: Response
  try {
    response = await meteredFetch(spec.id, spec.probeUrl(key), {
      ...spec.probeInit,
      routeTag: ROUTE_TAG,
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
    return {
      ...base,
      probed: true,
      httpStatus: null,
      status: "error",
      message: timedOut
        ? `Probe timed out after ${PROBE_TIMEOUT_MS} ms against ${spec.endpoint}.`
        : `Probe request threw: ${redact(String(error), key)}`,
    }
  }

  const raw = await response.text().catch(() => "")

  if (!response.ok) {
    const detail = raw ? ` Upstream said: ${snippet(redact(raw, key))}` : ""
    return {
      ...base,
      probed: true,
      httpStatus: response.status,
      status: "error",
      message: `HTTP ${response.status} ${response.statusText || ""}`.trim() + "." + detail,
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      ...base,
      probed: true,
      httpStatus: response.status,
      status: "error",
      message: `HTTP ${response.status} but the body was not JSON: ${snippet(redact(raw, key), 160)}`,
    }
  }

  // 200-with-error-body is a failure, not a pass.
  const bodyError = describeErrorBody(parsed)
  if (bodyError) {
    return {
      ...base,
      probed: true,
      httpStatus: response.status,
      status: "error",
      message: `HTTP ${response.status} with an error body: ${snippet(redact(bodyError, key))}`,
    }
  }

  return {
    ...base,
    probed: true,
    httpStatus: response.status,
    status: "ok",
    message: `HTTP ${response.status} from ${spec.endpoint} with a well-formed body.`,
  }
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startedAt = Date.now()
  const apis = await Promise.all(PROVIDERS.map(evaluate))

  const summary = {
    total: apis.length,
    ok: apis.filter((a) => a.status === "ok").length,
    error: apis.filter((a) => a.status === "error").length,
    disabled: apis.filter((a) => a.status === "disabled").length,
    unknown: apis.filter((a) => a.status === "unknown").length,
    probed: apis.filter((a) => a.probed).length,
    notProbed: apis.filter((a) => !a.probed).length,
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    /** Stated so the panel can never be read as "everything is measured". */
    note: `${summary.probed} of ${summary.total} providers were probed against the endpoint the app actually calls; the rest report key presence only and say why. Probes are recorded in the cost ledger.`,
    summary,
    apis,
  })
}
