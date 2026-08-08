import { NextResponse } from "next/server"
import { getMeteringSupabaseConfig } from "@/lib/metered-fetch"
import { BREADTH_UNIVERSE, BREADTH_UNIVERSE_AS_OF } from "@/lib/breadth-universe"

/**
 * Market breadth — % of the large-cap universe above its own 200-DMA (E-6a).
 *
 * Read-only view over the Supabase breadth_daily series written by
 * /api/cron/breadth. Honesty contract:
 *   - No stored rows → 503 "warming up", never an invented percentage.
 *   - sample_size rides along; a thin sample is visible, not hidden.
 *   - UNSCORED in CCPI until the lead-time backtest passes (E-6 constraint) —
 *     the payload says so explicitly so the UI cannot imply otherwise.
 *
 * Canary semantics (display-only): breadth < 45% while the index sits near
 * highs is the divergence this series exists to expose.
 */

export const dynamic = "force-dynamic"

export async function GET() {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) {
    return NextResponse.json(
      { error: "Breadth store is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 },
    )
  }

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/breadth_daily?select=day,pct_above_200dma,sample_size,universe_size&order=day.desc&limit=90`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }, signal: AbortSignal.timeout(8000), cache: "no-store" },
    )
    if (!res.ok) {
      return NextResponse.json({ error: `Breadth store read failed: HTTP ${res.status}` }, { status: 502 })
    }
    const rows = (await res.json()) as {
      day: string
      pct_above_200dma: string | number
      sample_size: number
      universe_size: number
    }[]

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "Breadth series is warming up — no computed days yet. Run the backfill via /api/cron/breadth?backfill=300.",
          universeSize: BREADTH_UNIVERSE.length,
          universeAsOf: BREADTH_UNIVERSE_AS_OF,
        },
        { status: 503 },
      )
    }

    const latest = rows[0]
    const pct = Number(latest.pct_above_200dma)
    return NextResponse.json({
      latest: {
        day: latest.day,
        pctAbove200DMA: pct,
        sampleSize: latest.sample_size,
        universeSize: latest.universe_size,
        thinSample: latest.sample_size < latest.universe_size * 0.8,
      },
      // Simple regime read, labeled as interpretation rather than data.
      reading: pct < 40 ? "weak — few stocks holding trend" : pct < 55 ? "narrowing" : pct < 75 ? "healthy" : "broad",
      series: rows
        .map((r) => ({ day: r.day, pct: Number(r.pct_above_200dma), sample: r.sample_size }))
        .reverse(),
      universeAsOf: BREADTH_UNIVERSE_AS_OF,
      scored: false,
      scoringNote:
        "Display/canary only. Earns CCPI weight only after a lead-time backtest against the 2000/2008/2020/2022 drawdown starts (AUDIT_BACKLOG E-6 design constraint).",
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
