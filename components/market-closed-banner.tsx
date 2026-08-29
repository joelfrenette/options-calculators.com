"use client"

// The market-closed gate for every scanner surface. When the regular session
// is shut, the scanners cannot get live option quotes — a run just burns API
// budget and ends in a confusing zero (the owner's 2026-08-29 complaint). This
// renders a loud, unmissable banner with a live countdown to the next open, and
// exports the hook the scanners use to DISABLE their run buttons so no doomed
// call ever fires.

import { useEffect, useState } from "react"
import { AlertOctagon } from "lucide-react"
import { getMarketStatus, formatCountdown, nextOpenLabel, type MarketStatus } from "@/lib/market-hours"

/**
 * The live market session status, re-evaluated once a second so the countdown
 * ticks and the gate flips exactly at the open. `mounted` is false on the
 * server and the first client render, so callers can avoid a hydration
 * mismatch (the status depends on the viewer's clock).
 */
export function useMarketStatus(): { status: MarketStatus; mounted: boolean } {
  const [status, setStatus] = useState<MarketStatus>(() => getMarketStatus())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setStatus(getMarketStatus())
    const id = setInterval(() => setStatus(getMarketStatus()), 1000)
    return () => clearInterval(id)
  }, [])

  return { status, mounted }
}

function Segment({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="tabular-nums text-3xl font-black leading-none text-white md:text-4xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-red-100/80">{unit}</span>
    </div>
  )
}

/**
 * Full-width closed-market banner with a live countdown. Renders nothing while
 * the market is open (or before mount, to keep SSR stable). Drop it at the top
 * of a scanner; pair it with `disabled={!useMarketStatus().status.isOpen}` on
 * the run controls.
 */
export function MarketClosedBanner() {
  const { status, mounted } = useMarketStatus()
  if (!mounted || status.isOpen) return null

  const c = formatCountdown(status.msUntilOpen)
  const reasonText =
    status.phase === "weekend"
      ? "It's the weekend."
      : status.phase === "holiday"
        ? `Closed for ${status.reason}.`
        : status.phase === "pre"
          ? "Pre-market — the session hasn't opened yet."
          : "After-hours — the session has closed."

  return (
    <div
      role="alert"
      className="mb-6 w-full max-w-7xl mx-auto overflow-hidden rounded-xl border-2 border-red-500 bg-gradient-to-br from-red-600 to-rose-700 shadow-xl"
    >
      <div className="flex flex-col items-center gap-4 p-5 md:flex-row md:justify-between md:p-6">
        <div className="flex items-start gap-3">
          <AlertOctagon className="mt-0.5 h-8 w-8 shrink-0 animate-pulse text-white" />
          <div>
            <h3 className="text-xl font-black uppercase tracking-wide text-white md:text-2xl">
              Markets are closed
            </h3>
            <p className="mt-1 text-sm font-medium text-red-50">
              {reasonText} The scanner needs live quotes, so it's paused — running it now would only return zeros
              and waste API calls.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center rounded-lg bg-black/20 px-5 py-3">
          <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-red-100">
            Opens in
          </span>
          <div className="flex items-start gap-3">
            {c.days > 0 && (
              <>
                <Segment value={c.days} unit="days" />
                <span className="text-3xl font-black text-red-200/60 md:text-4xl">:</span>
              </>
            )}
            <Segment value={c.hours} unit="hrs" />
            <span className="text-3xl font-black text-red-200/60 md:text-4xl">:</span>
            <Segment value={c.minutes} unit="min" />
            <span className="text-3xl font-black text-red-200/60 md:text-4xl">:</span>
            <Segment value={c.seconds} unit="sec" />
          </div>
          <span className="mt-2 text-xs font-semibold text-red-50">{nextOpenLabel(status)}</span>
        </div>
      </div>
    </div>
  )
}
