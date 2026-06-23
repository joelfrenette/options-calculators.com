"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  X,
  ChevronLeft,
  ChevronRight,
  MousePointerClick,
  Search,
  CheckCircle2,
  GraduationCap,
  Lightbulb,
  AlertTriangle,
  Sparkles,
} from "lucide-react"

export interface WalkthroughSetup {
  ticker: string
  setup: string
  credit: string
  pop: string
  direction: string
  signal?: string
}

interface TradeWalkthroughModalProps {
  open: boolean
  onClose: () => void
  setup: WalkthroughSetup | null
  strategyKey?: string
  strategyName: string
  typicalDTE?: string
}

type CoachKind = "say" | "why" | "tip" | "warn"
type ScreenKind = "intro" | "trade-tab" | "chain" | "ticket" | "confirm" | "manage"

interface CoachLine {
  kind: CoachKind
  text: string
}

interface WalkStep {
  title: string
  screen: ScreenKind
  coach: CoachLine[]
}

interface Leg {
  side: "SELL" | "BUY"
  qty: number
  strike: number | null
  right: "PUT" | "CALL" | "STOCK"
  label: string
}

// Per-strategy thinkorswim order mechanics. `vertical` flag controls whether we
// can render the detailed SELL/BUY option-chain mockup vs. a generic leg ticket.
interface StrategyFlow {
  orderType: string
  rightClick: string
  vertical: boolean
  isCredit: boolean
  buildWhy: string
  manageTip: string
}

const STRATEGY_FLOWS: Record<string, StrategyFlow> = {
  "credit-spreads": {
    orderType: "Vertical",
    rightClick: "Right-click the short strike → Sell → Vertical",
    vertical: true,
    isCredit: true,
    buildWhy:
      "You sell the strike closer to the money to collect premium, and buy the further strike as insurance that caps your loss.",
    manageTip: "Take profit around 50% of the credit collected; close if price threatens your short strike.",
  },
  "iron-condors": {
    orderType: "Iron Condor",
    rightClick: "Right-click a strike → Sell → Iron Condor",
    vertical: true,
    isCredit: true,
    buildWhy:
      "An iron condor is two credit spreads — a put spread below price and a call spread above. You profit if price stays between the short strikes.",
    manageTip: "Take profit near 50% of total credit; defend the tested side if price runs to a short strike.",
  },
  butterflies: {
    orderType: "Butterfly",
    rightClick: "Right-click the body strike → Buy → Butterfly",
    vertical: false,
    isCredit: false,
    buildWhy:
      "A butterfly buys the wings and sells the body (2x). It is cheap and pays the most if price pins your center strike at expiration.",
    manageTip: "These are slow movers — let theta work, and target 25–50% of max profit rather than the peak.",
  },
  "calendar-spreads": {
    orderType: "Calendar",
    rightClick: "Right-click the strike → Buy → Calendar",
    vertical: false,
    isCredit: false,
    buildWhy:
      "You sell the near-term option and buy the same strike further out. The near option decays faster, which is your edge.",
    manageTip: "Profit comes from time decay and stable price; close before the front-month expiration week.",
  },
  diagonals: {
    orderType: "Diagonal",
    rightClick: "Right-click the strike → Buy → Diagonal",
    vertical: false,
    isCredit: false,
    buildWhy:
      "A diagonal mixes a calendar and a vertical — different strikes and different expirations — for directional plus time-decay exposure.",
    manageTip: "Roll the short leg forward to keep collecting premium against your longer-dated long option.",
  },
  collars: {
    orderType: "Collar",
    rightClick: "Build legs from the chain: buy a protective put, sell a covered call",
    vertical: false,
    isCredit: false,
    buildWhy:
      "A collar protects stock you own: the long put is a floor, and selling the call pays for that protection by capping upside.",
    manageTip: "This is a protective hedge — adjust the strikes as the stock moves to keep your floor in place.",
  },
  "straddles-strangles": {
    orderType: "Straddle / Strangle",
    rightClick: "Right-click a strike → Buy → Straddle (or Strangle)",
    vertical: false,
    isCredit: false,
    buildWhy:
      "You buy both a call and a put to profit from a big move in either direction. Your enemy is time decay and falling volatility.",
    manageTip: "You need a real move to win — take profits quickly on a spike and don't hold through IV crush.",
  },
  "wheel-strategy": {
    orderType: "Cash-Secured Put",
    rightClick: "Right-click the put strike → Sell → Single",
    vertical: false,
    isCredit: true,
    buildWhy:
      "You sell a cash-secured put to get paid while waiting to buy a stock you like at a discount. If assigned, you then sell covered calls.",
    manageTip: "Only sell puts on stocks you'd happily own; take profit near 50% or roll if challenged.",
  },
}

const DEFAULT_FLOW: StrategyFlow = STRATEGY_FLOWS["credit-spreads"]

// Extract trade legs from the human-readable setup string. Returns the legs
// (for the ticket mockup) plus the two key strikes when it's a clean vertical.
function parseSetup(setup: string, flow: StrategyFlow) {
  const text = setup
  const isPut = /put/i.test(text) && !/call/i.test(text)
  const baseRight: Leg["right"] = /put/i.test(text) ? "PUT" : "CALL"

  // Pull every number out of the string (strikes).
  const nums = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter((n) => n > 0)

  let shortStrike: number | null = null
  let longStrike: number | null = null
  let width = 0
  const legs: Leg[] = []

  // Explicit "Buy ... Sell ..." phrasing (collars, diagonals).
  const explicit = text.match(/(buy|sell)\s+[^,]*?(\d+(?:\.\d+)?)\s*(put|call|p|c)?/gi)
  if (explicit && explicit.length >= 2) {
    explicit.forEach((seg) => {
      const side = /buy/i.test(seg) ? "BUY" : "SELL"
      const strikeMatch = seg.match(/(\d+(?:\.\d+)?)/)
      const strike = strikeMatch ? Number(strikeMatch[1]) : null
      const right: Leg["right"] = /put|p\b/i.test(seg) ? "PUT" : /call|c\b/i.test(seg) ? "CALL" : baseRight
      legs.push({ side, qty: 1, strike, right, label: seg.trim().replace(/\s+/g, " ") })
    })
  } else if (flow.vertical && nums.length >= 2) {
    // Vertical: sell the strike nearer the money, buy the protective wing.
    const a = nums[0]
    const b = nums[1]
    if (isPut) {
      shortStrike = Math.max(a, b)
      longStrike = Math.min(a, b)
    } else {
      shortStrike = Math.min(a, b)
      longStrike = Math.max(a, b)
    }
    width = Math.abs(a - b)
    legs.push({ side: "SELL", qty: 1, strike: shortStrike, right: baseRight, label: `Sell ${shortStrike} ${baseRight}` })
    legs.push({ side: "BUY", qty: 1, strike: longStrike, right: baseRight, label: `Buy ${longStrike} ${baseRight}` })
  } else {
    // Generic: just present the setup text as the order to build.
    shortStrike = nums[0] ?? null
    longStrike = nums[1] ?? null
    width = nums.length >= 2 ? Math.abs(nums[0] - nums[1]) : 0
  }

  return { shortStrike, longStrike, width, right: baseRight, isPut, legs, nums }
}

export function TradeWalkthroughModal({
  open,
  onClose,
  setup,
  strategyKey = "credit-spreads",
  strategyName,
  typicalDTE = "30–45 days",
}: TradeWalkthroughModalProps) {
  const [stepIndex, setStepIndex] = useState(0)

  const flow = STRATEGY_FLOWS[strategyKey] ?? DEFAULT_FLOW
  const parsed = useMemo(() => (setup ? parseSetup(setup.setup, flow) : null), [setup, flow])

  const steps: WalkStep[] = useMemo(() => {
    if (!setup || !parsed) return []
    return [
      {
        title: "What we're building",
        screen: "intro",
        coach: [
          {
            kind: "say",
            text: `We'll place this ${strategyName} example — ${setup.setup} on ${setup.ticker} — together, one click at a time, in thinkorswim desktop.`,
          },
          {
            kind: "why",
            text: `This is a defined-risk trade. You ${flow.isCredit ? "collect" : "pay"} ${
              setup.credit
            } per contract. ${flow.buildWhy}`,
          },
          {
            kind: "tip",
            text: `Probability of profit on this example is ${setup.pop}. This is a teaching example, not a recommendation — but the mechanics are exactly how you'd place it for real.`,
          },
        ],
      },
      {
        title: "Open the Trade tab",
        screen: "trade-tab",
        coach: [
          {
            kind: "say",
            text: `Click the "Trade" tab, type ${setup.ticker} in the symbol box, and press Enter.`,
          },
          {
            kind: "why",
            text: "The Trade tab holds the live option chain. The symbol box loads everything for that one ticker.",
          },
        ],
      },
      {
        title: "Pick your expiration",
        screen: "chain",
        coach: [
          {
            kind: "say",
            text: `Find the expiration roughly ${typicalDTE} out and click to expand it.`,
          },
          {
            kind: "why",
            text: `${typicalDTE} is the sweet spot for ${strategyName.toLowerCase()} — meaningful premium with time decay working the way you want.`,
          },
          {
            kind: "warn",
            text: "Avoid landing on an earnings date unless that event is the entire point of the trade.",
          },
        ],
      },
      {
        title: "Build the order",
        screen: flow.vertical ? "chain" : "ticket",
        coach: [
          {
            kind: "say",
            text: `${flow.rightClick}. thinkorswim builds a ${flow.orderType} order for you.`,
          },
          ...(parsed.legs.length
            ? [
                {
                  kind: "say" as CoachKind,
                  text: `Confirm the legs: ${parsed.legs.map((l) => l.label).join(", ")}.`,
                },
              ]
            : [
                {
                  kind: "say" as CoachKind,
                  text: `Set it up to match the example: ${setup.setup}.`,
                },
              ]),
          { kind: "why", text: flow.buildWhy },
        ],
      },
      {
        title: "Read the order ticket",
        screen: "ticket",
        coach: [
          {
            kind: "say",
            text: "The Order Entry panel appears at the bottom. Leave quantity at 1 to start and set the price to the natural mid.",
          },
          {
            kind: "why",
            text: `Check three numbers: the ${flow.isCredit ? "credit" : "debit"} (${
              setup.credit
            }), your max loss, and the Buying Power Effect. Never risk more than you planned.`,
          },
          {
            kind: "tip",
            text: "Use a LIMIT order with DAY or GTC duration so you never fill at a worse price than you chose.",
          },
        ],
      },
      {
        title: "Confirm and send",
        screen: "confirm",
        coach: [
          {
            kind: "say",
            text: 'Click "Confirm and Send." A summary dialog restates the legs, net price, and fees.',
          },
          {
            kind: "why",
            text: "This is your final checkpoint — it re-states max profit and max loss so there are no surprises after the fill.",
          },
          { kind: "say", text: 'Happy with it? Click "Send." You now hold a live position.' },
        ],
      },
      {
        title: "Manage the trade",
        screen: "manage",
        coach: [
          { kind: "tip", text: flow.manageTip },
          {
            kind: "warn",
            text: "Plan your exit before you need it. Decide your profit target and your stop now, not in the heat of the moment.",
          },
          {
            kind: "say",
            text: "Use the Monitor tab to watch P/L. Right-click the position to create a closing order whenever you're ready.",
          },
        ],
      },
    ]
  }, [setup, parsed, flow, strategyName, typicalDTE])

  if (!setup || !parsed) return null

  const current = steps[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === steps.length - 1
  const progress = ((stepIndex + 1) / steps.length) * 100

  const handleClose = () => {
    setStepIndex(0)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="max-w-none w-screen h-screen sm:w-[96vw] sm:h-[94vh] sm:max-w-6xl p-0 gap-0 overflow-hidden rounded-none sm:rounded-xl flex flex-col"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-[#1E3A8A] px-4 py-3 text-white sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-teal-200">
                Guided Walkthrough · thinkorswim Desktop
              </p>
              <h2 className="text-sm font-bold sm:text-base">
                {strategyName}: {setup.setup} on {setup.ticker}
              </h2>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-white hover:bg-white/15 hover:text-white"
            aria-label="Close walkthrough"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Progress */}
        <div className="bg-[#1E3A8A]/95 px-4 pb-3 sm:px-6">
          <div className="flex items-center justify-between text-xs text-teal-100">
            <span>
              Step {stepIndex + 1} of {steps.length}
            </span>
            <span className="font-medium">{current.title}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-teal-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,380px)_1fr]">
          {/* Coach column */}
          <div className="flex flex-col gap-3 overflow-y-auto border-b bg-gray-50 p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Coach</p>
                <p className="text-xs text-gray-500">Walking you through it</p>
              </div>
            </div>
            {current.coach.map((line, i) => (
              <CoachBubble key={i} line={line} />
            ))}
          </div>

          {/* Screen mockup column */}
          <div className="flex items-center justify-center overflow-auto bg-[#0f1729] p-4 sm:p-6">
            <ScreenMockup
              screen={current.screen}
              setup={setup}
              parsed={parsed}
              flow={flow}
              typicalDTE={typicalDTE}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t bg-white px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={isFirst}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>

          <div className="hidden items-center gap-1.5 sm:flex">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStepIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === stepIndex ? "bg-teal-600" : i < stepIndex ? "bg-teal-300" : "bg-gray-300"
                }`}
              />
            ))}
          </div>

          {isLast ? (
            <Button onClick={handleClose} className="bg-[#0D9488] text-white hover:bg-[#0F766E]">
              Finish
              <CheckCircle2 className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
              className="bg-[#0D9488] text-white hover:bg-[#0F766E]"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CoachBubble({ line }: { line: CoachLine }) {
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

function Annotation({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div className={`pointer-events-none absolute z-20 ${className}`}>
      <div className="flex items-center gap-1.5 rounded-md bg-amber-400 px-2 py-1 text-[11px] font-bold text-gray-900 shadow-lg">
        <MousePointerClick className="h-3 w-3" />
        {label}
      </div>
    </div>
  )
}

function ScreenFrame({ title, children }: { title: string; children: React.ReactNode }) {
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

function ScreenMockup({
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
              <p className="font-bold text-white">{width > 0 ? `≈ $${width}00` : "See ticket"}</p>
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

function LegList({ legs, setup }: { legs: Leg[]; setup: WalkthroughSetup }) {
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
