import { NextResponse } from "next/server"
import { generateWithFallback } from "@/lib/ai-providers"
import { ensureBudgetGuardFresh } from "@/lib/budget-guard"
import { TOTAL_SCORED_INDICATORS } from "@/lib/ccpi/scoring"
import { isDryRun, dryRunPayload } from "@/lib/dry-run"

// The provider chain and its fallback loop used to be duplicated here, in full.
// Deleted in favour of `generateWithFallback` — see the note at the call site.

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // P7-19. These were `?? 0`, and the prompt below renders them as
    // "CCPI Score: ${ccpi}/100" directly under a legend that reads
    // "0-19: Low Risk (markets healthy)". So a composite that could not be
    // scored was narrated to the model as the strongest all-clear on the
    // scale, and the model's answer is what the user reads as the executive
    // summary.
    //
    // P6-19 fixed the PILLARS for exactly this reason — see `pillarLine`
    // below, which prints "insufficient data" rather than a number — and left
    // the composite the pillars roll up into. The client defaulted it too
    // (`Math.round(null)` is 0), so this guard never even fired; both are
    // fixed together, because either one alone leaves the other free to
    // reintroduce the zero.
    const ccpi = typeof body.ccpi === "number" ? body.ccpi : null
    const rawCertainty = body.certainty ?? body.confidence
    const certainty = typeof rawCertainty === "number" ? rawCertainty : null
    const activeCanaries =
      body.activeCanaries ?? (body.canaries ? body.canaries.filter((c: any) => c.active).length : 0)
    // The canary-array length is NOT the indicator count — that substitution is
    // what narrated "3 of 12" against a 29-indicator index (P6-19), and it was
    // still sitting here as the fallback. The count is derived from the weight
    // tables, so fall back to that; the client sends null when the payload
    // carried no count (P7-2), which is what makes this reachable at all.
    const totalIndicators =
      typeof body.totalIndicators === "number" ? body.totalIndicators : TOTAL_SCORED_INDICATORS
    const regime = body.regime ?? { name: "Unknown", description: "Unknown" }
    // Pillars arrive null when too little of their weight was live/AI-sourced.
    // `?? { …: 0 }` and a bare `${pillars.momentum}/100` both told the model a
    // hard zero — maximum crash signal — for a pillar that was never scored.
    const pillars = body.pillars ?? { momentum: null, riskAppetite: null, valuation: null, macro: null }
    const pillarLine = (label: string, score: number | null | undefined, weight: string) =>
      `  * ${label}: ${score === null || score === undefined ? `insufficient data — excluded from the composite (Weight: ${weight})` : `${score}/100 (Weight: ${weight})`}`
    const unscoredPillars = ["momentum", "riskAppetite", "valuation", "macro"].filter((k) => pillars[k] == null)

    const prompt = `You are a professional financial analyst providing an executive summary for the CCPI (Comprehensive Crash & Correction Prediction Index).

## CCPI METHODOLOGY CONTEXT:
The CCPI is a proprietary market crash prediction index that aggregates ${TOTAL_SCORED_INDICATORS} scored market indicators across 4 weighted pillars:
- **Pillar 1: Momentum & Technical (35%)** - Tracks price trends, moving averages, breadth indicators
- **Pillar 2: Risk Appetite & Volatility (30%)** - Measures VIX, put/call ratios, credit spreads, investor sentiment
- **Pillar 3: Valuation & Market Structure (15%)** - Analyzes P/E ratios, CAPE, market concentration, equity risk premium
- **Pillar 4: Macro (20%)** - Evaluates economic indicators like ISM PMI, yield curves, debt levels

The final CCPI score is calculated as: Σ(Pillar Score × Weight), ranging from 0-100 where:
- 0-19: Low Risk (markets healthy)
- 20-39: Normal (typical market conditions)
- 40-59: Caution (elevated risk, defensive positioning recommended)
- 60-79: High Alert (significant crash probability)
- 80-100: Crash Watch (imminent correction likely)

## CERTAINTY SCORE METHODOLOGY:
The certainty score measures signal consistency and alignment:
- It calculates how many indicators agree directionally within each pillar
- Higher certainty = more indicators pointing in the same direction = higher confidence in the CCPI reading
- Lower certainty = mixed signals = less confidence, more uncertainty in market direction

## CURRENT MARKET DATA:
- CCPI Score: ${ccpi === null ? "NOT SCOREABLE — too little of the index was backed by live data to compute a composite. Do NOT infer a level, a regime, or a direction from its absence, and do not treat it as low risk." : `${ccpi}/100`}
- Certainty Score: ${certainty === null ? "unavailable" : `${certainty}%`}
- Active Warning Signals: ${activeCanaries} of ${totalIndicators} indicators triggered
- Market Regime: ${regime.name} (${regime.description})
- Pillar Scores:
${pillarLine("Momentum & Technical", pillars.momentum, "35%")}
${pillarLine("Risk Appetite & Volatility", pillars.riskAppetite, "30%")}
${pillarLine("Valuation & Market Structure", pillars.valuation, "15%")}
${pillarLine("Macro", pillars.macro, "20%")}${
      unscoredPillars.length > 0
        ? `
- DATA GAP: ${unscoredPillars.length} of 4 pillars could not be scored. State this in the summary and do not infer a reading for them. "Insufficient data" means UNKNOWN — not zero, and not healthy.`
        : ""
    }

## YOUR TASK:
Write a comprehensive 2-3 sentence executive summary that:
1. ${
      ccpi === null
        ? "States plainly that the CCPI could not be scored for this reading and says which pillars were missing. Do NOT name a risk zone — there is no score to place in one."
        : "States the CCPI score and what risk zone it falls in (Low Risk/Normal/Caution/High Alert/Crash Watch)"
    }
2. ${
      // `null >= 70` and `null >= 50` are both false, so an absent certainty
      // used to fall through to "low signal consistency" — an assertion about
      // signal agreement that nothing measured, stated with the same confidence
      // as a real reading (P7-19).
      certainty === null
        ? "Does not discuss the certainty score: it was not available for this reading. Say so in one clause rather than characterising it."
        : `Explains the ${certainty}% certainty score means ${certainty >= 70 ? "high signal agreement - strong confidence in the reading" : certainty >= 50 ? "moderate signal alignment - reasonable confidence but some mixed signals" : "low signal consistency - significant uncertainty, mixed market signals"}`
    }
3. Identifies which pillar(s) are driving the score (highest scoring pillars = most concerning)
4. Provides specific, actionable guidance for options traders based on this data

Make it professional, data-driven, and immediately actionable for sophisticated traders. Focus on what the numbers mean and what traders should DO.`

    // Budget guard (E-5): refresh before spending, so `config.key()` below
    // resolves to "" for guarded providers once the kill switch has tripped.
    await ensureBudgetGuardFresh()

    // P2-4. The dry run stops HERE — after body parsing, the null-aware pillar
    // rendering and the budget-guard refresh, and before any provider is
    // touched. It deliberately sits AFTER `ensureBudgetGuardFresh()`, because a
    // guard that fails to refresh is exactly the kind of silent spend-control
    // break this route had no test for at all.
    if (isDryRun(request, body)) {
      return NextResponse.json(
        dryRunPayload("/api/ccpi/executive-summary", "lib/ai-providers.ts fallback chain", prompt.length),
      )
    }

    // P7-9 again, one route over. This used to be a PRIVATE COPY of the
    // provider chain and its fallback loop — the fourth written-down copy of
    // the provider vocabulary — and it had drifted exactly the way
    // /api/ccpi/chat's copy did before that one was deleted: **six providers
    // against the canonical seven, with Perplexity simply absent**, so this
    // route gave up one fallback earlier than every other AI route. Its `name`
    // strings had drifted too ("OpenRouter (free)", "Groq", "xAI" against the
    // canonical "openrouter", "groq", "xai"), and those names were handed to
    // the client in the response's `provider` field.
    //
    // The sharp end is the same as last time: `getProviderChain()` is what the
    // admin AI tab renders as "the live fallback chain, in the exact order the
    // generate/stream loops try it" — derived from the canonical array — so the
    // panel was describing a chain this route did not use. That is a provenance
    // defect, not a tidiness one.
    //
    // The empty-response check that was this copy's one real justification now
    // lives inside `generateWithFallback`, where every caller gets it.
    const result = await generateWithFallback({
      prompt,
      temperature: 0.7,
      // ai v5 renamed this from `maxTokens`. Under the old name the option was
      // silently dropped, so output length was unbounded on the paid fallbacks
      // — a real spend leak, not just a type error.
      maxTokens: 300,
      abortSignal: AbortSignal.timeout(30000),
      routeTag: "/api/ccpi/executive-summary",
    })

    return NextResponse.json({ summary: result.text.trim(), provider: result.provider })
  } catch (error) {
    console.error("[AI] Executive summary error:", error)

    // This used to return, at HTTP 200, a `summary` reading "CCPI analysis is
    // currently being generated. The market data has been successfully loaded."
    // Both halves were false: every provider had already failed and nothing was
    // still generating, and it asserted success inside the error path.
    //
    // It landed in the field the dashboard renders AS the executive summary,
    // beneath a line reading "Generated by Grok xAI" — so a failure produced a
    // reassuring sentence with a model's name under it. No status code is worth
    // that; returning 503 with no summary lets the page show nothing, which is
    // what actually happened.
    return NextResponse.json(
      {
        error: "AI generation temporarily unavailable",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    )
  }
}
