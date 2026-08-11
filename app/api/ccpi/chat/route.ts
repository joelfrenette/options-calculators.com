import { NextResponse } from "next/server"
import { convertToModelMessages, type UIMessage } from "ai"
import { isDryRun, dryRunPayload } from "@/lib/dry-run"
import { streamWithFallback } from "@/lib/ai-providers"
import { TOTAL_SCORED_INDICATORS } from "@/lib/ccpi/scoring"


export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages, ccpiContext }: { messages: UIMessage[]; ccpiContext: any } = await req.json()

    // A pillar is null when under 40 of its 100 weight came from live or AI
    // data — the composite renormalizes over the pillars that scored. Rendering
    // that as "0/100" told the model MAXIMUM crash signal, the exact opposite
    // of "we don't know", and it then reasoned and advised from there.
    const pillarLine = (label: string, score: number | null | undefined) =>
      `  * ${label}: ${score === null || score === undefined ? "insufficient data — excluded from the composite" : `${score}/100`}`

    const unscoredPillars = ccpiContext
      ? ["momentum", "riskAppetite", "valuation", "macro"].filter((k) => ccpiContext.pillars?.[k] == null)
      : []

    const systemPrompt = `You are a professional financial analyst AI assistant specializing in the CCPI (Comprehensive Crash & Correction Prediction Index). You help options traders understand market crash risk and make informed decisions.

## CCPI METHODOLOGY:
The CCPI aggregates ${TOTAL_SCORED_INDICATORS} scored market indicators across 4 weighted pillars:
- **Pillar 1: Momentum & Technical (35%)** - Price trends, moving averages (QQQ 20/50-day SMA), market breadth
- **Pillar 2: Risk Appetite & Volatility (30%)** - VIX levels, put/call ratios, credit spreads, AAII sentiment
- **Pillar 3: Valuation & Market Structure (15%)** - S&P P/E, CAPE, Buffett Indicator, Mag7 concentration, equity risk premium
- **Pillar 4: Macro (20%)** - ISM PMI, yield curve, US Debt-to-GDP, Dollar Index

CCPI Score Interpretation:
- 0-19: Low Risk - Markets healthy, risk-on strategies appropriate
- 20-39: Normal - Typical conditions, balanced approach
- 40-59: Caution - Elevated risk, consider defensive positioning
- 60-79: High Alert - Significant crash probability, reduce exposure
- 80-100: Crash Watch - Imminent correction likely, maximum defense

Certainty Score: Measures signal consistency (how many indicators agree). Higher = more confidence in the CCPI reading.

## CURRENT MARKET DATA:
${
  ccpiContext
    ? `
- CCPI Score: ${ccpiContext.ccpi ?? "unavailable"}/100 (${ccpiContext.regime?.name || "Unknown"} regime)
- Certainty Score: ${ccpiContext.certainty ?? "unavailable"}%
- Active Warning Signals: ${ccpiContext.activeWarnings ?? "unavailable"} of ${ccpiContext.totalIndicators ?? TOTAL_SCORED_INDICATORS}
- Pillar Scores:
${pillarLine("Momentum & Technical", ccpiContext.pillars?.momentum)}
${pillarLine("Risk Appetite & Volatility", ccpiContext.pillars?.riskAppetite)}
${pillarLine("Valuation & Market Structure", ccpiContext.pillars?.valuation)}
${pillarLine("Macro", ccpiContext.pillars?.macro)}${
        unscoredPillars.length > 0
          ? `
- DATA GAP: ${unscoredPillars.length} of 4 pillars could not be scored. Say so when the user asks about them or about the composite, and do not infer a reading for them. A pillar marked "insufficient data" is UNKNOWN, not zero and not healthy.`
          : ""
      }
${ccpiContext.crashAmplifiers?.length > 0 ? `- Crash Amplifiers Active: ${ccpiContext.crashAmplifiers.join(", ")}` : ""}
${
  ccpiContext.activeSignals?.length > 0
    ? `- Key Active Signals: ${ccpiContext.activeSignals
        .slice(0, 5)
        .map((s: any) => s.name || s)
        .join(", ")}`
    : ""
}
`
    : "No CCPI data available currently."
}

## RESPONSE GUIDELINES:
- Be concise but thorough
- Reference specific CCPI data when relevant
- Provide actionable insights for options traders
- Explain technical concepts clearly
- If asked about specific strategies, relate them to the current CCPI level
- Never give specific trade recommendations, only educational guidance`

    const prompt = convertToModelMessages(messages)

    // P7-9. The provider chain, the budget-guard refresh and the spend
    // accounting used to be re-implemented here, and the copy had drifted:
    // it listed SIX providers where `lib/ai-providers.ts` lists seven —
    // Perplexity was simply absent, so a chat turn gave up one fallback
    // earlier than every other AI route. The `provider` tag it wrote to the
    // spend ledger had drifted too ("OpenRouter (free)", "Groq", "xAI"
    // against the canonical "openrouter", "groq", "xai"), which split one
    // vendor into two rows in the admin Measured-usage card.
    //
    // Worse than either: `getProviderChain()` — what the admin panel renders
    // as "the live fallback chain, in the exact order the generate/stream
    // loops try it" — is derived from the canonical array, so the panel was
    // stating something untrue about this route. That is a provenance defect,
    // not a tidiness one.
    //
    // `streamWithFallback` is the shared path this route should always have
    // used. It was dead code for exactly as long as the copy existed.

    // P2-4. The dry run returns plain JSON rather than a stream, and that is
    // the honest shape: there is no stream, because there is no model. A probe
    // that returned an empty UI-message stream would be asserting that the
    // streaming path works when nothing streamed. What this DOES cover is the
    // part of the route that has actually been wrong before — the system-prompt
    // build, where P6-19 found pillars rendered as "0/100" to the model, and
    // the budget-guard refresh above it. The streaming transport itself stays
    // unverified and is recorded as such.
    if (isDryRun(req, { messages, ccpiContext })) {
      return NextResponse.json({
        ...dryRunPayload("/api/ccpi/chat", "streamWithFallback (lib/ai-providers chain)", systemPrompt.length),
        streams: true,
        note: "Request path exercised; no model was called, so no stream was opened and no content was generated.",
      })
    }

    // `streamWithFallback` awaits the budget guard, walks the canonical chain,
    // and records the spend row itself. It throws when every provider fails,
    // which the outer catch turns into a 500.
    const { stream } = await streamWithFallback({
      messages: prompt,
      system: systemPrompt,
      temperature: 0.7,
      maxTokens: 1000,
      abortSignal: req.signal,
      routeTag: "/api/ccpi/chat",
    })

    return stream.toUIMessageStreamResponse()
  } catch (error) {
    console.error("[AI] CCPI chat error:", error)
    return new Response(JSON.stringify({ error: "Failed to process chat request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
