// The social-sentiment composite's weights, and the CORPUS each one reads
// (P6-65).
//
// WHY THE CORPUS FIELD IS THE POINT. The weights were per-INDICATOR while the
// concentration risk is per-CORPUS, so the concentration was invisible in the
// table that caused it. "Finnhub News" (0.11) and "News Fear & Greed" (0.08) are
// two lenses over ONE Finnhub general-news article set — same endpoint, same
// `category=general`, same seven-day window — and the second name conceals it.
// Read down the weight column and you see six sources, none above 0.16. Read
// down the corpus column and you see **0.19 of the composite, 30% of the live
// weight, resting on one article list.**
//
// They are not scalar multiples and can genuinely disagree — one scores headline
// tone over the top 50, the other counts greed/fear words over the top 30 — so
// this is milder than a straight double-count. But two readings of one article
// set are two opinions, not two witnesses, and if Finnhub goes quiet the tab
// loses that share in a single step while looking exactly as confident.
//
// The owner's decision (2026-08-13) was to reduce it rather than remove the
// source: the corpus is real measured data, unlike the VIX-derived proxies of
// P6-8. The pair now carries 0.10 between them, in their previous 11:8 ratio.
//
// ABSOLUTE SCALE IS IRRELEVANT AND THAT IS DELIBERATE. The route divides by the
// total weight of the LIVE sources, so these numbers are ratios, not
// percentages, and "renormalising the rest" happens on its own — the same
// property that let AAII's 0.12 be removed without touching another row. The
// invariant below is therefore expressed as a SHARE, not as a sum.
//
// Import-free: `scripts/check-social-sentiment-weights.ts` loads this under
// node's type stripping to assert the concentration cap.

export interface SentimentWeight {
  /** Display name, and the key the route builds its indicator row under. */
  name: string
  weight: number
  group: "macro" | "social"
  /**
   * The underlying article set / feed. Two rows sharing a corpus are two lenses
   * on one witness, and their weights add up against the cap below.
   */
  corpus: string
}

export const SENTIMENT_WEIGHTS: SentimentWeight[] = [
  // --- Hard data / aggregated indices (highest reliability) ---
  { name: "CNN Fear & Greed", weight: 0.16, group: "macro", corpus: "cnn-fear-greed" },
  { name: "Finnhub News", weight: 0.06, group: "macro", corpus: "finnhub-general-news" },
  { name: "Polygon News", weight: 0.1, group: "macro", corpus: "polygon-news" },
  { name: "News Fear & Greed", weight: 0.04, group: "macro", corpus: "finnhub-general-news" },
  // --- Social / retail scrapes (lower reliability) ---
  { name: "StockTwits", weight: 0.11, group: "social", corpus: "stocktwits-spy" },
  { name: "Google News", weight: 0.08, group: "social", corpus: "google-news-rss" },
]

/**
 * The cap. No single corpus may carry more than this share of the total weight.
 *
 * 0.20 rather than something tighter because CNN's own 0.16 is 0.31 of the total
 * on its own — and CNN is a genuine multi-factor index, not a re-reading of
 * something already counted, so the cap deliberately applies to corpora that
 * appear MORE THAN ONCE. A single-row corpus is a weighting judgement; a
 * multi-row corpus is a concentration that the table hides.
 */
export const MAX_MULTI_ROW_CORPUS_SHARE = 0.2

export function totalWeight(weights: SentimentWeight[] = SENTIMENT_WEIGHTS): number {
  return weights.reduce((sum, w) => sum + w.weight, 0)
}

/** Share of the total weight held by each corpus, keyed by corpus id. */
export function corpusShares(weights: SentimentWeight[] = SENTIMENT_WEIGHTS): Record<string, number> {
  const total = totalWeight(weights)
  const out: Record<string, number> = {}
  for (const w of weights) out[w.corpus] = (out[w.corpus] ?? 0) + w.weight
  if (total > 0) for (const k of Object.keys(out)) out[k] = out[k] / total
  return out
}

/** Corpora read by more than one indicator row. */
export function multiRowCorpora(weights: SentimentWeight[] = SENTIMENT_WEIGHTS): string[] {
  const counts: Record<string, number> = {}
  for (const w of weights) counts[w.corpus] = (counts[w.corpus] ?? 0) + 1
  return Object.keys(counts).filter((c) => counts[c] > 1)
}

/** The weight for a named indicator, or null if it is not in the table. */
export function weightFor(name: string, weights: SentimentWeight[] = SENTIMENT_WEIGHTS): number | null {
  return weights.find((w) => w.name === name)?.weight ?? null
}
