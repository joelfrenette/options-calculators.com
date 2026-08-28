"use client"

// Step 4 entry exclusions (P7-30/P7-45). Extracted from step4-technical-card.tsx,
// which had grown to 678 lines — 157 of them this block. P6-13 caps modules at
// 600 and the entry-exclusion feature is what pushed four scanner files past it,
// so the split starts with the files that work created rather than the CCPI and
// market-sentiment surfaces, where a refactor is a money risk rather than a
// tidy-up.
//
// JSX moved verbatim, de-indented only. The toggles keep their ids, so the
// controls check-playbook-rules.ts looks for are unchanged.

import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { MAX_DAY_MOVE } from "@/lib/trend-filters"
import { stepLabel } from "./steps"

interface EntryExclusionControlsProps {
  excludeBigUpDay: boolean
  setExcludeBigUpDay: (value: boolean) => void
  maxDayMove: number[]
  setMaxDayMove: (value: number[]) => void
  excludeDownYear: boolean
  setExcludeDownYear: (value: boolean) => void
  excludeBenchmarkLaggard: boolean
  setExcludeBenchmarkLaggard: (value: boolean) => void
  excludeStage4: boolean
  setExcludeStage4: (value: boolean) => void
  tooltipsEnabled: boolean
}

export function EntryExclusionControls({
  excludeBigUpDay,
  setExcludeBigUpDay,
  maxDayMove,
  setMaxDayMove,
  excludeDownYear,
  setExcludeDownYear,
  excludeBenchmarkLaggard,
  setExcludeBenchmarkLaggard,
  excludeStage4,
  setExcludeStage4,
  tooltipsEnabled,
}: EntryExclusionControlsProps) {
  return (
    <>
      {/* CSP entry filters. Unlike the gates above these default ON, so
          the block is visually separated and says so — a user who finds
          an empty result set needs to know which filters were already
          running before they start loosening the sliders. */}
      <div className="mt-8 pt-6 border-t border-blue-200">
        <h4 className="text-sm font-bold text-gray-900 mb-1">Entry exclusions</h4>
        <p className="text-xs text-gray-600 mb-4">
          These four are <strong>on by default</strong> — they remove candidates rather than rank them. A stock
          whose history is too short to measure is excluded by the filter that needs it, never passed through.
          Three are <strong>hard gates</strong> that also hold in the relaxed {stepLabel("relaxed")} pass — a big
          up day, a down year, and a Stage 4 decline never appear on any list. Trailing SPY is the soft one:{" "}
          {stepLabel("relaxed")} relaxes it to a Beat SPY flag.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-3 rounded-lg border bg-card md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <Label className="flex items-center gap-2 cursor-pointer">
                Exclude a stock that just ripped
                {tooltipsEnabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm bg-green-50 border-green-200 text-gray-900">
                      <p className="font-semibold mb-1">Big up-day exclusion</p>
                      <p className="text-sm">
                        A large up session comes with an implied-volatility spike, so the put premium looks rich.
                        If the pop was a reaction to news, the volatility crush lands within a day — you keep a
                        collapsing premium against a full retracement of downside. The strike is also chosen off
                        the inflated price, so a strike that looked well out of the money can sit at the money
                        after the retrace.
                      </p>
                      <p className="text-sm mt-2">
                        The row shows the move in ATR units too: a 10% day in a stock that swings 1% daily is a
                        different event from one in a stock that swings 8%.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </Label>
              <input
                id="bigUpDayToggle"
                type="checkbox"
                checked={excludeBigUpDay}
                onChange={(e) => setExcludeBigUpDay(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>
            <Label className="text-xs text-gray-600">
              Exclude at or above: <span className="font-semibold text-gray-900">{maxDayMove[0]}%</span> in one
              session
            </Label>
            <Slider
              value={maxDayMove}
              onValueChange={setMaxDayMove}
              min={MAX_DAY_MOVE.MIN}
              max={MAX_DAY_MOVE.MAX}
              step={MAX_DAY_MOVE.STEP}
              disabled={!excludeBigUpDay}
              className="mt-2"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <Label className="flex items-center gap-2 cursor-pointer">
              Exclude down on the year
              {tooltipsEnabled ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm bg-green-50 border-green-200 text-gray-900">
                    <p className="font-semibold mb-1">Trailing 12-month return below zero</p>
                    <p className="text-sm">
                      Total return over the last 252 trading sessions. Selling a put is an agreement to buy the
                      stock, so a year of decline is a year of the market disagreeing with that purchase.
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </Label>
            <input
              id="downYearToggle"
              type="checkbox"
              checked={excludeDownYear}
              onChange={(e) => setExcludeDownYear(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <Label className="flex items-center gap-2 cursor-pointer">
              Exclude laggards vs SPY
              {tooltipsEnabled ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm bg-green-50 border-green-200 text-gray-900">
                    <p className="font-semibold mb-1">Relative strength over 12 months</p>
                    <p className="text-sm">
                      The stock&apos;s trailing-year return minus SPY&apos;s over the same window — the simple
                      form of what IBD&apos;s RS Rating and Mansfield&apos;s Relative Performance both measure.
                      This is the clause that separates &ldquo;it fell&rdquo; from &ldquo;it fell while the market
                      rose&rdquo;.
                    </p>
                    <p className="text-sm mt-2">
                      When SPY&apos;s own year is positive this is the <em>stricter</em> of the two year-long
                      filters: a stock up 7.5% against a market up 8% passes &ldquo;down on the year&rdquo; and
                      fails this one. When the market itself fell they disagree — a stock down 5% while SPY fell
                      20% outperformed by 15 points but is still down on the year.
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </Label>
            <input
              id="benchmarkLaggardToggle"
              type="checkbox"
              checked={excludeBenchmarkLaggard}
              onChange={(e) => setExcludeBenchmarkLaggard(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-card md:col-span-2">
            <Label className="flex items-center gap-2 cursor-pointer">
              Exclude Stage 4 declines
              {tooltipsEnabled ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm bg-green-50 border-green-200 text-gray-900">
                    <p className="font-semibold mb-1">Weinstein Stage 4</p>
                    <p className="text-sm">
                      Price below a 30-week (150-session) moving average that is <strong>itself falling</strong>.
                      The slope is the part that matters: price below a <em>rising</em> long average is a pullback
                      inside an advance, which is the setup a put seller wants. Price below a <em>falling</em> one
                      is the stage the method exists to keep you out of.
                    </p>
                    <p className="text-sm mt-2">
                      This catches a breakdown that started recently, which a 12-month return can still show as
                      positive.
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </Label>
            <input
              id="stage4Toggle"
              type="checkbox"
              checked={excludeStage4}
              onChange={(e) => setExcludeStage4(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </>
  )
}
