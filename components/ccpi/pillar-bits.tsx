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
 * Shows how much of the pillar's 100-point weight actually scored, how much of
 * that was live vs AI-estimated, and which indicators were excluded.
 */
export function PillarProvenanceLine({ prov }: { prov?: CCPIPillarProvenance }) {
  if (!prov) return null
  return (
    <p className="text-xs text-muted-foreground border-l-2 border-blue-200 pl-2">
      Scored {prov.scoredMax}/100 weight · {prov.liveMax} live · {prov.aiMax} AI-est
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
