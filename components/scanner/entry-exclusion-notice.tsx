"use client"

// Shared entry-exclusion surface for the six server-driven scanner tabs
// (P7-32). The Sell Put scanner has its own card in scanner-notices.tsx because
// its exclusions run client-side against the Step 3 results; these six get
// theirs from /api/strategy-scanner's `entryExclusions` field.

import { Filter } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { MAX_DAY_MOVE } from "@/lib/trend-filters"

export interface EntryExclusion {
  ticker: string
  reasons: string[]
}

export interface EntryExclusionPolicy {
  maxDayMovePercent: number
  benchmark: string
  benchmarkReturn12m: number | null
  trendGatedStrategies: string[]
  spikeGatedStrategies: string[]
  ungated: string[]
}

interface EntryExclusionNoticeProps {
  excluded: EntryExclusion[]
  policy: EntryExclusionPolicy | null
  /** The strategy key this tab requests, e.g. "leaps". */
  strategy: string
  /** Current big-up-day threshold. */
  maxDayMove: number
  onMaxDayMoveChange: (value: number) => void
  /**
   * Re-runs the scan. The threshold is a SERVER parameter — excluded tickers
   * never reach the client, so there is nothing to re-filter locally.
   *
   * It takes the new value explicitly, and that is not decoration. Calling a
   * zero-argument refresh right after `onMaxDayMoveChange` reads the PREVIOUS
   * threshold out of the parent's closure, because React state is not updated
   * synchronously — the scan would run with the number the user just changed
   * away from, and the result would look like the filter had not worked.
   */
  onRescan: (maxDayMove: number) => void
  disabled?: boolean
}

/**
 * What the entry exclusions removed, and the control that sets the one
 * threshold they take.
 *
 * ALWAYS RENDERED WHEN A POLICY IS PRESENT, even with nothing excluded — and
 * that is the opposite choice from the Sell Put scanner's card, deliberately.
 * There the exclusions are visible as toggles a few inches up the page, so a
 * "0 excluded" card would be noise. Here the gates run on the server with no
 * other on-screen trace, so a tab that shows nothing is indistinguishable from
 * a tab with no gates at all — and the threshold control has to live
 * somewhere.
 */
export function EntryExclusionNotice({
  excluded,
  policy,
  strategy,
  maxDayMove,
  onMaxDayMoveChange,
  onRescan,
  disabled,
}: EntryExclusionNoticeProps) {
  if (!policy) return null

  const key = strategy.split(" ")[0]
  const trendGated = policy.trendGatedStrategies.some((s) => s.split(" ")[0] === key)
  const spikeGated = policy.spikeGatedStrategies.includes(key)

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <Filter className="h-4 w-4" />
          {excluded.length === 0
            ? "Entry exclusions active — nothing excluded on this scan"
            : `${excluded.length} candidate${excluded.length === 1 ? "" : "s"} excluded`}
        </div>
        {/* The SAME control as the Sell Put scanner's Step 4 card, reading the
            same range from lib/trend-filters. One number, one meaning — a
            dropdown of eight fixed steps here and a continuous slider there
            made "10%" mean two slightly different things depending on which
            tab you were looking at.

            Committed on release rather than on drag: every change is a server
            round trip, and a slider that refetches per pixel would fire a
            dozen scans crossing from 3 to 15. */}
        <label className="flex min-w-[16rem] flex-1 items-center gap-3 text-xs text-amber-900">
          <span className="whitespace-nowrap">
            Exclude a session move at or above{" "}
            <span className="font-semibold text-amber-950">{maxDayMove}%</span>
          </span>
          <Slider
            value={[maxDayMove]}
            onValueChange={(v) => onMaxDayMoveChange(v[0])}
            onValueCommit={(v) => onRescan(v[0])}
            min={MAX_DAY_MOVE.MIN}
            max={MAX_DAY_MOVE.MAX}
            step={MAX_DAY_MOVE.STEP}
            disabled={disabled}
            className="flex-1"
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-amber-800">
        {spikeGated ? `A session move of ${policy.maxDayMovePercent}% or more excludes the ticker. ` : ""}
        {trendGated
          ? `A negative trailing 12-month return, a year behind ${policy.benchmark}${
              policy.benchmarkReturn12m === null ? "" : ` (${policy.benchmarkReturn12m.toFixed(1)}%)`
            }, or a Stage 4 decline also excludes it. `
          : "The year-long trend filters do not apply here — this is a neutral position, where a falling stock is not disqualifying. "}
        A ticker whose history cannot be measured is excluded rather than assumed fine.
      </p>

      {excluded.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {excluded.map((e, i) => (
            <span
              key={`${e.ticker}-${i}`}
              className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-1 text-xs"
            >
              <span className="font-semibold text-gray-900">{e.ticker}</span>
              <span className="text-gray-600">{e.reasons.join(" · ")}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
