// Research Queue — the morning recap (RESEARCH_QUEUE_DESIGN.md §Phase 3).
//
// Deterministic deltas between a queued ticker's fresh recommendation and the
// one it replaced: strategy flips, CSP band moves, and LEAPS/price-drop triggers
// now in range. Numbers are COMPUTED; the optional Opus 5 pass only narrates
// these deltas into prose, with a deterministic fallback when the model is
// unavailable. Micro price drift is deliberately NOT surfaced (owner decision
// 2026-09-03) — only flips, band moves and triggers earn a line.

import { generateWithFallback } from "@/lib/ai-providers"
import type { OptionsRecommendation, RecapItem } from "./types"

/** True when either CSP band edge shifted (a strike move, or the band appearing/disappearing). */
function bandMoved(prev: OptionsRecommendation, cur: OptionsRecommendation): boolean {
  const edges: [number | null, number | null][] = [
    [prev.cspStrikeLow, cur.cspStrikeLow],
    [prev.cspStrikeHigh, cur.cspStrikeHigh],
  ]
  return edges.some(([a, b]) => {
    if (a === null || b === null) return a !== b
    return Math.abs(a - b) >= 0.01
  })
}

/**
 * Deltas for one ticker, comparing the fresh recommendation to the prior one.
 * `prev` is null on a ticker's first-ever research.
 */
export function tickerDeltas(
  ticker: string,
  cur: OptionsRecommendation,
  prev: OptionsRecommendation | null,
): RecapItem[] {
  const items: RecapItem[] = []

  if (!prev) {
    items.push({ ticker, kind: "new", detail: `${ticker}: first read — ${cur.strategy} (${cur.rating}).` })
  } else {
    if (prev.strategy !== cur.strategy) {
      items.push({
        ticker,
        kind: "flip",
        detail: `${ticker}: strategy ${prev.strategy} → ${cur.strategy} (${cur.rating}).`,
      })
    }
    if (cur.strategy === "CSP" && prev.strategy === "CSP" && bandMoved(prev, cur)) {
      items.push({
        ticker,
        kind: "band",
        detail: `${ticker}: CSP band $${prev.cspStrikeLow}–$${prev.cspStrikeHigh} → $${cur.cspStrikeLow}–$${cur.cspStrikeHigh}.`,
      })
    }
  }

  // LEAPS / price-drop trigger: the underlying is at or below the buy-below level.
  if (cur.price !== null && cur.leapsBuyBelowPrice !== null && cur.price <= cur.leapsBuyBelowPrice) {
    items.push({
      ticker,
      kind: "trigger",
      detail: `${ticker}: LEAPS trigger in range — buy below $${cur.leapsBuyBelowPrice}, now $${cur.price} (~$${cur.leapsStrike} strike, ${cur.leapsDte}d).`,
    })
  }

  return items
}

/** A one-line deterministic summary of the collected deltas. */
function deterministicSummary(items: RecapItem[], tickerCount: number): string {
  const n = `${tickerCount} ticker${tickerCount === 1 ? "" : "s"}`
  if (items.length === 0) return `No changes overnight across ${n}.`
  const count = (k: RecapItem["kind"]) => items.filter((i) => i.kind === k).length
  const flips = count("flip")
  const bands = count("band")
  const triggers = count("trigger")
  const news = count("new")
  const parts: string[] = []
  if (flips) parts.push(`${flips} strategy flip${flips === 1 ? "" : "s"}`)
  if (bands) parts.push(`${bands} band move${bands === 1 ? "" : "s"}`)
  if (triggers) parts.push(`${triggers} trigger${triggers === 1 ? "" : "s"} in range`)
  if (news) parts.push(`${news} new`)
  return `${parts.join(", ")} across ${n}.`
}

/**
 * Opus 5 narration over the deterministic deltas. Falls back to the deterministic
 * sentence when there is nothing to narrate or the model is unavailable, so the
 * recap always exists. The model receives ONLY the computed delta lines and may
 * not invent tickers, prices or levels.
 */
export async function narrateRecap(
  items: RecapItem[],
  tickerCount: number,
): Promise<{ summary: string; isLlm: boolean }> {
  const deterministic = deterministicSummary(items, tickerCount)
  if (items.length === 0) return { summary: deterministic, isLlm: false }

  const facts = items.map((i) => `- ${i.detail}`).join("\n")
  const prompt = `You are an options strategist writing a brief morning note for a premium seller running the wheel and buying LEAPS. Below are the overnight changes across a watchlist, already computed. Summarize what matters in 2–4 sentences. Use ONLY these facts — do not invent tickers, prices, or levels. Be practical and concise.

${facts}

Morning note:`

  try {
    const result = await generateWithFallback({ prompt, temperature: 0.4, maxTokens: 240, routeTag: "research-recap" })
    const text = result.text.trim()
    return text.length > 0 ? { summary: text, isLlm: true } : { summary: deterministic, isLlm: false }
  } catch {
    return { summary: deterministic, isLlm: false }
  }
}
