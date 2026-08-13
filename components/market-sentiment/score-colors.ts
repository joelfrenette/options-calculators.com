/**
 * Score → colour, keyed by the band `SENTIMENT_ALLOCATION` already decided.
 *
 * Split out of `components/market-sentiment.tsx` (P6-13) unchanged, with the
 * comment that explains why it is a lookup and not a second set of thresholds.
 */
import { SENTIMENT_ALLOCATION, bandForScore } from "@/lib/allocation"

/*
  ONE classification per gauge. Everything below is a lookup on the level
  SENTIMENT_ALLOCATION already decided — there is no second set of thresholds
  to drift out of step.

  This is not hypothetical tidying. Colour used >= 25/45/56/75 while the
  recommendation text used <= 24/44/55/74; identical for whole numbers, and
  the API rounds to one decimal, so 36 of the 1001 reachable scores were
  coloured one level and described as another.
*/
const levelFor = (score: number) => bandForScore(SENTIMENT_ALLOCATION.bands, score)?.level ?? null

const SCORE_COLORS: Record<string, string> = {
  "Extreme Greed": "text-green-600",
  Greed: "text-green-500",
  Neutral: "text-yellow-600",
  Fear: "text-orange-500",
  "Extreme Fear": "text-red-600",
}

const SCORE_BACKGROUNDS: Record<string, string> = {
  "Extreme Greed": "bg-green-50 border-green-200",
  Greed: "bg-green-50 border-green-200",
  Neutral: "bg-yellow-50 border-yellow-200",
  Fear: "bg-orange-50 border-orange-200",
  "Extreme Fear": "bg-red-50 border-red-200",
}

// Grey rather than a level colour when there is no band — an unreadable
// score must not be styled as a real reading (P6-30).
export const getScoreColor = (score: number) => SCORE_COLORS[levelFor(score) ?? ""] ?? "text-gray-500"
export const getScoreBackground = (score: number) =>
  SCORE_BACKGROUNDS[levelFor(score) ?? ""] ?? "bg-gray-50 border-gray-200"

