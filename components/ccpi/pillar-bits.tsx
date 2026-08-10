"use client"

/**
 * Per-pillar provenance line and score display.
 *
 * Both encode an audit rule rather than a layout choice: the provenance line
 * states how much of a pillar's weight actually scored, and PillarScore renders
 * an explicit "insufficient data" rather than 0 or NaN when a pillar is null.
 * Lifted verbatim from components/ccpi-dashboard.tsx.
 */

import type { CCPIPillarProvenance } from "@/lib/ccpi/types"

/**
 * Compact per-pillar data-provenance summary (added by the P3 scoring rework).
 *
 * Since P6-34 only LIVE weight scores, so `scoredMax` and `liveMax` are the
 * same number and printing both said nothing. `aiMax` changed meaning with the
 * same decision: it is now weight that was DROPPED for being an LLM estimate of
 * a published figure, not weight that counted at half credit. The wording has
 * to follow the arithmetic, or the line quietly keeps making the old claim.
 */
export function PillarProvenanceLine({ prov }: { prov?: CCPIPillarProvenance }) {
  if (!prov) return null
  return (
    <p className="text-xs text-muted-foreground border-l-2 border-blue-200 pl-2">
      Scored {prov.scoredMax}/100 weight, all live
      {prov.aiMax > 0 ? ` · ${prov.aiMax} dropped as AI-estimated` : ""}
      {prov.excluded.length > 0 ? ` · excluded: ${prov.excluded.join(", ")}` : ""}
    </p>
  )
}

/**
 * Pillar score display. A pillar is null when less than the minimum scored
 * weight was backed by live/AI data — render an explicit "insufficient data"
 * state instead of 0 or NaN.
 */
export function PillarScore({ score }: { score: number | null }) {
  if (score === null || !Number.isFinite(score)) {
    return <span className="text-sm font-semibold text-gray-500 italic">Insufficient data</span>
  }
  return <span className="text-2xl font-bold text-blue-600">{Math.round(score)}/100</span>
}
