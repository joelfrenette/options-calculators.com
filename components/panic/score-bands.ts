/**
 * Score to colour, background and label, all keyed by the band
 * `PANIC_EUPHORIA_ALLOCATION` already decided.
 *
 * Split out of `components/panic-euphoria.tsx` (P6-13) unchanged, with the
 * comment explaining why it is one classification and three lookups rather than
 * four parallel threshold chains.
 */
import { PANIC_EUPHORIA_ALLOCATION, bandForScore } from "@/lib/allocation"

/*
  ONE classification per gauge — PANIC_EUPHORIA_ALLOCATION decides the level
  and everything below is a lookup on it. Four parallel threshold chains for
  colour, background, label and recommendations is four chances to disagree,
  and the sentiment page proved that is not theoretical.
*/
const levelFor = (score: number) => bandForScore(PANIC_EUPHORIA_ALLOCATION.bands, score)?.level ?? null

const SCORE_COLORS: Record<string, string> = {
  "Extreme Panic": "text-green-700", // GOOD - buy signal
  Panic: "text-green-600",
  "Neutral/Complacent": "text-yellow-600",
  Euphoria: "text-red-500",
  "Extreme Euphoria": "text-red-700", // BAD - sell signal
}

const SCORE_BACKGROUNDS: Record<string, string> = {
  "Extreme Panic": "bg-green-100 border-green-400",
  Panic: "bg-green-50 border-green-300",
  "Neutral/Complacent": "bg-yellow-50 border-yellow-200",
  Euphoria: "bg-red-50 border-red-300",
  "Extreme Euphoria": "bg-red-100 border-red-400",
}

const SCORE_LABELS: Record<string, string> = {
  "Extreme Panic": "EXTREME PANIC (Buy Signal)",
  Panic: "PANIC (Contrarian Bullish)",
  "Neutral/Complacent": "NEUTRAL/COMPLACENT",
  Euphoria: "EUPHORIA (Contrarian Bearish)",
  "Extreme Euphoria": "EXTREME EUPHORIA (Sell Signal)",
}

// Grey and "NO DATA" when the score is unreadable — never a level's styling
// on a reading that does not exist (P6-30).
export const getScoreColor = (score: number) => SCORE_COLORS[levelFor(score) ?? ""] ?? "text-gray-500"
export const getScoreBackground = (score: number) =>
  SCORE_BACKGROUNDS[levelFor(score) ?? ""] ?? "bg-gray-50 border-gray-200"
export const getScoreLabel = (score: number) => SCORE_LABELS[levelFor(score) ?? ""] ?? "NO DATA"

