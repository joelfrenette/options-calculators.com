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
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-white/70">{unit}</span>
    </div>
  )
}

/**
 * Full-width closed-market banner with a live countdown. Renders nothing while
 * the market is open (or before mount, to keep SSR stable).
 *
 * `variant` picks the tone:
 *   - "block" (default) — the SCANNER gate: red, screaming, and it means the
 *     run controls are disabled. Pair with the action guard in the scanner.
 *   - "info" — a read-only DASHBOARD (sentiment, panic/euphoria, CCPI): amber,
 *     calmer, "these figures are the last session's close". Nothing to disable
 *     there, so it informs rather than blocks.
 */
export function MarketClosedBanner({ variant = "block" }: { variant?: "block" | "info" }) {
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

  const isBlock = variant === "block"
  const shell = isBlock
    ? "border-red-500 bg-gradient-to-br from-red-600 to-rose-700"
    : "border-amber-400 bg-gradient-to-br from-amber-500 to-orange-600"
  const bodyText = isBlock ? "text-red-50" : "text-amber-50"
  const message = isBlock
    ? `${reasonText} The scanner needs live quotes, so it's paused — running it now would only return zeros and waste API calls.`
    : `${reasonText} These figures reflect the last session's close — live updates resume when the market reopens.`

  return (
    <div
      role={isBlock ? "alert" : "status"}
      className={`mb-6 w-full max-w-7xl mx-auto overflow-hidden rounded-xl border-2 shadow-xl ${shell}`}
    >
      <div className="flex flex-col items-center gap-4 p-5 md:flex-row md:justify-between md:p-6">
        <div className="flex items-start gap-3">
          <AlertOctagon className={`mt-0.5 h-8 w-8 shrink-0 text-white ${isBlock ? "animate-pulse" : ""}`} />
          <div>
            <h3 className="text-xl font-black uppercase tracking-wide text-white md:text-2xl">
              Markets are closed
            </h3>
            <p className={`mt-1 text-sm font-medium ${bodyText}`}>{message}</p>
          </div>
        </div>

        <div className="flex flex-col items-center rounded-lg bg-black/20 px-5 py-3">
          <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/80">
            {isBlock ? "Opens in" : "Live data in"}
          </span>
          <div className="flex items-start gap-3">
            {c.days > 0 && (
              <>
                <Segment value={c.days} unit="days" />
                <span className="text-3xl font-black text-white/50 md:text-4xl">:</span>
              </>
            )}
            <Segment value={c.hours} unit="hrs" />
            <span className="text-3xl font-black text-white/50 md:text-4xl">:</span>
            <Segment value={c.minutes} unit="min" />
            <span className="text-3xl font-black text-white/50 md:text-4xl">:</span>
            <Segment value={c.seconds} unit="sec" />
          </div>
          <span className="mt-2 text-xs font-semibold text-white/90">{nextOpenLabel(status)}</span>
        </div>
      </div>
    </div>
  )
}
