"use client"

/**
 * The broker-screen mockups the walkthrough steps through: the coach bubble, the
 * callout annotation, the framed screen and the option-chain / ticket mockup.
 *
 * Split out of `components/trade-walkthrough-modal.tsx` (P6-13) unchanged.
 *
 * These are ILLUSTRATIONS OF A BROKER UI, not this site's own screens and not a
 * live chain. They are drawn from the setup string the modal was handed, which
 * is why `parseSetup` returns nothing rather than inventing a shape when the
 * string does not describe a clean vertical.
 */
import type React from "react"
import {
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  Lightbulb,
  MousePointerClick,
  Search,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CoachKind, CoachLine, ScreenKind, WalkthroughSetup } from "./walkthrough-types"
import type { Leg, StrategyFlow } from "./strategy-flows"
import { parseSetup } from "./parse-setup"

export function CoachBubble({ line }: { line: CoachLine }) {
  const styles: Record<CoachKind, { wrap: string; icon: typeof Lightbulb; label: string; iconColor: string }> = {
    say: { wrap: "bg-white border-gray-200", icon: MousePointerClick, label: "Do this", iconColor: "text-teal-600" },
    why: { wrap: "bg-blue-50 border-blue-200", icon: Lightbulb, label: "Why", iconColor: "text-blue-600" },
    tip: { wrap: "bg-teal-50 border-teal-200", icon: Sparkles, label: "Tip", iconColor: "text-teal-600" },
    warn: {
      wrap: "bg-amber-50 border-amber-200",
      icon: AlertTriangle,
      label: "Watch out",
      iconColor: "text-amber-600",
    },
  }
  const s = styles[line.kind]
  const Icon = s.icon
  return (
    <div className={`relative rounded-2xl rounded-tl-sm border p-3 shadow-sm ${s.wrap}`}>
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${s.iconColor}`} />
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${s.iconColor}`}>{s.label}</span>
      </div>
      <p className="text-sm leading-relaxed text-gray-800">{line.text}</p>
    </div>
  )
}

// ---- Annotated thinkorswim-style mockups (original recreations, not real screenshots) ----

export function Annotation({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div className={`pointer-events-none absolute z-20 ${className}`}>
      <div className="flex items-center gap-1.5 rounded-md bg-amber-400 px-2 py-1 text-[11px] font-bold text-gray-900 shadow-lg">
        <MousePointerClick className="h-3 w-3" />
        {label}
      </div>
    </div>
  )
}

export function ScreenFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-gray-700 bg-[#1b2333] shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-gray-700 bg-[#11182a] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-2 text-[11px] font-medium text-gray-300">{title}</span>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  )
}

export function ScreenMockup({
  screen,
  setup,
  parsed,
  flow,
  typicalDTE,
}: {
  screen: ScreenKind
  setup: WalkthroughSetup
  parsed: NonNullable<ReturnType<typeof parseSetup>>
  flow: StrategyFlow
  typicalDTE: string
}) {
  const { right, shortStrike, longStrike, width, legs } = parsed

  if (screen === "intro") {
    return (
      <ScreenFrame title="thinkorswim — Overview">
        <div className="space-y-3 text-gray-200">
          <div className="rounded-md border border-teal-500/40 bg-teal-500/10 p-3">
            <p className="text-xs uppercase tracking-wide text-teal-300">Today&apos;s lesson</p>
            <p className="mt-1 text-lg font-bold text-white">
              {setup.setup} on {setup.ticker}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-[#11182a] p-2">
              <p className="text-[10px] uppercase text-gray-400">{flow.isCredit ? "Credit" : "Debit"}</p>
              <p className="text-sm font-bold text-green-400">{setup.credit}</p>
            </div>
            <div className="rounded-md bg-[#11182a] p-2">
              <p className="text-[10px] uppercase text-gray-400">POP</p>
              <p className="text-sm font-bold text-blue-300">{setup.pop}</p>
            </div>
            <div className="rounded-md bg-[#11182a] p-2">
              <p className="text-[10px] uppercase text-gray-400">Bias</p>
              <p className="text-sm font-bold text-white">{setup.direction}</p>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400">Click Next to start placing the trade →</p>
        </div>
      </ScreenFrame>
    )
  }

  if (screen === "trade-tab") {
    return (
      <ScreenFrame title="thinkorswim — Trade">
        <div className="relative">
          <div className="flex gap-1 text-xs font-medium">
            {["Monitor", "Trade", "Analyze", "Scan"].map((t) => (
              <div
                key={t}
                className={`relative rounded-t px-3 py-1.5 ${
                  t === "Trade" ? "bg-[#1b2333] text-teal-300" : "bg-[#11182a] text-gray-400"
                }`}
              >
                {t}
                {t === "Trade" && <Annotation label="1. Click Trade" className="-top-9 left-0" />}
              </div>
            ))}
          </div>
          <div className="relative mt-3 flex items-center gap-2 rounded border border-teal-400 bg-[#11182a] px-3 py-2">
            <Search className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-bold text-white">{setup.ticker}</span>
            <span className="ml-auto text-xs text-gray-400">Enter symbol</span>
            <Annotation label={`2. Type ${setup.ticker} + Enter`} className="-top-9 right-0" />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] text-gray-300">
            {["Last", "Bid", "Ask", "IV"].map((l) => (
              <div key={l} className="rounded bg-[#11182a] p-2">
                {l}
                <br />
                <span className="font-bold text-white">—</span>
              </div>
            ))}
          </div>
        </div>
      </ScreenFrame>
    )
  }

  if (screen === "chain" && flow.vertical && shortStrike && longStrike) {
    const allStrikes = Array.from(
      new Set([shortStrike + width, Math.max(shortStrike, longStrike), Math.min(shortStrike, longStrike), longStrike - width]),
    ).filter((v) => v > 0)
    return (
      <ScreenFrame title="thinkorswim — Option Chain">
        <div className="relative">
          <div className="relative mb-2 flex items-center justify-between rounded border border-teal-400 bg-[#11182a] px-3 py-1.5 text-xs">
            <span className="font-semibold text-teal-300">▼ {typicalDTE} out</span>
            <span className="text-gray-400">Exp group</span>
            <Annotation label="Expand this expiration" className="-top-9 left-0" />
          </div>
          <div className="overflow-hidden rounded border border-gray-700 text-[11px]">
            <div className="grid grid-cols-[1fr_auto_1fr] bg-[#11182a] text-gray-400">
              <div className="px-2 py-1 text-center">CALLS (Bid/Ask)</div>
              <div className="px-3 py-1 text-center font-bold text-gray-200">Strike</div>
              <div className="px-2 py-1 text-center">PUTS (Bid/Ask)</div>
            </div>
            {allStrikes
              .sort((a, b) => b - a)
              .map((strike) => {
                const isShort = strike === shortStrike
                const isLong = strike === longStrike
                const rowHighlight = isShort ? "bg-red-500/20" : isLong ? "bg-green-500/15" : "bg-[#1b2333]"
                return (
                  <div key={strike} className={`relative grid grid-cols-[1fr_auto_1fr] ${rowHighlight}`}>
                    <div className="px-2 py-1.5 text-center text-gray-300">
                      {right === "CALL" ? "1.20 / 1.25" : "0.80 / 0.85"}
                    </div>
                    <div className="border-x border-gray-700 px-3 py-1.5 text-center font-bold text-white">{strike}</div>
                    <div className="px-2 py-1.5 text-center text-gray-300">
                      {right === "PUT" ? "2.10 / 2.18" : "0.45 / 0.50"}
                      {isShort && (
                        <Annotation label={flow.rightClick} className="-top-8 right-0 whitespace-nowrap" />
                      )}
                    </div>
                    {isShort && (
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 rounded bg-red-500 px-1 text-[9px] font-bold text-white">
                        SELL
                      </span>
                    )}
                    {isLong && (
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 rounded bg-green-600 px-1 text-[9px] font-bold text-white">
                        BUY
                      </span>
                    )}
                  </div>
                )
              })}
          </div>
          <p className="mt-2 text-center text-[11px] text-gray-400">
            Short the <span className="text-teal-300">{shortStrike} {right}</span>, protected by the long{" "}
            <span className="text-teal-300">{longStrike} {right}</span> · {width}-wide
          </p>
        </div>
      </ScreenFrame>
    )
  }

  if (screen === "chain") {
    // Non-vertical strategies: show the chain with a generic "build order" prompt.
    return (
      <ScreenFrame title="thinkorswim — Option Chain">
        <div className="relative">
          <div className="relative mb-2 flex items-center justify-between rounded border border-teal-400 bg-[#11182a] px-3 py-1.5 text-xs">
            <span className="font-semibold text-teal-300">▼ {typicalDTE} out</span>
            <span className="text-gray-400">Exp group</span>
            <Annotation label="Expand this expiration" className="-top-9 left-0" />
          </div>
          <div className="rounded border border-gray-700 bg-[#11182a] p-3 text-center text-[11px] text-gray-300">
            <p className="mb-2 font-semibold text-teal-300">{flow.orderType} order</p>
            <p className="text-gray-400">{flow.rightClick}</p>
          </div>
          <LegList legs={legs} setup={setup} />
        </div>
      </ScreenFrame>
    )
  }

  if (screen === "ticket") {
    return (
      <ScreenFrame title="thinkorswim — Order Entry">
        <div className="relative space-y-2 text-[11px]">
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 rounded bg-[#11182a] px-2 py-1.5 font-semibold text-gray-400">
            <span>Side</span>
            <span>Leg</span>
            <span>Qty</span>
            <span>Price</span>
          </div>
          {legs.length > 0 ? (
            legs.map((leg, i) => (
              <div
                key={i}
                className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded px-2 py-1.5 text-white ${
                  leg.side === "SELL" ? "bg-red-500/15" : "bg-green-500/15"
                }`}
              >
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                    leg.side === "SELL" ? "bg-red-500" : "bg-green-600"
                  }`}
                >
                  {leg.side}
                </span>
                <span>
                  {setup.ticker} {leg.strike ?? ""} {leg.right !== "STOCK" ? leg.right : ""}
                </span>
                <span>{leg.qty}</span>
                <span>—</span>
              </div>
            ))
          ) : (
            <div className="rounded bg-[#1b2333] px-2 py-2 text-center text-gray-300">{setup.setup}</div>
          )}

          <div className="relative mt-2 flex items-center justify-between rounded border border-teal-400 bg-[#11182a] px-3 py-2">
            <span className="text-gray-300">Net price (LIMIT)</span>
            <span className="font-bold text-green-400">
              {setup.credit} {flow.isCredit ? "CR" : "DR"}
            </span>
            <Annotation label="Set LIMIT at the mid" className="-top-8 right-0" />
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded bg-[#11182a] p-2">
              <p className="text-[9px] uppercase text-gray-400">Max Profit</p>
              <p className="font-bold text-green-400">{flow.isCredit ? setup.credit : "Defined"}</p>
            </div>
            <div className="rounded bg-[#11182a] p-2">
              <p className="text-[9px] uppercase text-gray-400">Max Loss</p>
              <p className="font-bold text-red-400">{flow.isCredit ? "Width − Credit" : setup.credit}</p>
            </div>
            <div className="rounded bg-[#11182a] p-2">
              <p className="text-[9px] uppercase text-gray-400">BP Effect</p>
              <p className="font-bold text-white">{width > 0 ? `≈ $${(width * 100).toLocaleString()}` : "See ticket"}</p>
            </div>
          </div>
        </div>
      </ScreenFrame>
    )
  }

  if (screen === "confirm") {
    return (
      <ScreenFrame title="thinkorswim — Order Confirmation">
        <div className="relative mx-auto max-w-sm space-y-3 text-gray-200">
          <p className="text-center text-sm font-semibold text-white">Confirm and Send</p>
          <div className="space-y-1 rounded border border-gray-700 bg-[#11182a] p-3 text-[11px]">
            {legs.length > 0 ? (
              legs.map((leg, i) => (
                <div key={i} className="flex justify-between">
                  <span className={leg.side === "SELL" ? "text-red-400" : "text-green-400"}>
                    {leg.side === "SELL" ? "SELL −" : "BUY +"}
                    {leg.qty}
                  </span>
                  <span>
                    {setup.ticker} {leg.strike ?? ""} {leg.right !== "STOCK" ? leg.right : ""}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-300">{setup.setup}</div>
            )}
            <div className="my-1 border-t border-gray-700" />
            <div className="flex justify-between font-bold text-white">
              <span>Net</span>
              <span className="text-green-400">
                {setup.credit} {flow.isCredit ? "credit" : "debit"}
              </span>
            </div>
          </div>
          <div className="relative">
            <Button className="w-full bg-[#0D9488] text-white hover:bg-[#0F766E]">Send</Button>
            <Annotation label="Final check, then Send" className="-top-8 right-0" />
          </div>
          <p className="text-center text-[11px] text-gray-400">Review legs, net price, and fees before sending.</p>
        </div>
      </ScreenFrame>
    )
  }

  // manage
  return (
    <ScreenFrame title="thinkorswim — Monitor / Position">
      <div className="relative space-y-2 text-[11px] text-gray-200">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 rounded bg-[#11182a] px-2 py-1.5 font-semibold text-gray-400">
          <span>Position</span>
          <span>P/L Open</span>
          <span>Action</span>
        </div>
        <div className="relative grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded bg-[#1b2333] px-2 py-2">
          <span className="text-white">
            {setup.ticker} {setup.setup}
          </span>
          <span className="font-bold text-green-400">+$—</span>
          <span className="rounded bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white">Close</span>
          <Annotation label="Right-click → Create closing order" className="-top-8 right-0 whitespace-nowrap" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded border border-green-500/40 bg-green-500/10 p-2 text-center">
            <p className="text-[9px] uppercase text-green-300">Take profit</p>
            <p className="font-bold text-white">{flow.isCredit ? "~50% of credit" : "25–50% of max"}</p>
          </div>
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-center">
            <p className="text-[9px] uppercase text-amber-300">Stop / adjust</p>
            <p className="font-bold text-white">Before it runs away</p>
          </div>
        </div>
      </div>
    </ScreenFrame>
  )
}

export function LegList({ legs, setup }: { legs: Leg[]; setup: WalkthroughSetup }) {
  if (legs.length === 0) {
    return (
      <div className="mt-2 rounded bg-[#1b2333] px-2 py-2 text-center text-[11px] text-gray-300">{setup.setup}</div>
    )
  }
  return (
    <div className="mt-2 space-y-1">
      {legs.map((leg, i) => (
        <div
          key={i}
          className={`flex items-center justify-between rounded px-2 py-1.5 text-[11px] text-white ${
            leg.side === "SELL" ? "bg-red-500/15" : "bg-green-500/15"
          }`}
        >
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
              leg.side === "SELL" ? "bg-red-500" : "bg-green-600"
            }`}
          >
            {leg.side}
          </span>
          <span>
            {setup.ticker} {leg.strike ?? ""} {leg.right !== "STOCK" ? leg.right : ""}
          </span>
        </div>
      ))}
    </div>
  )
}

