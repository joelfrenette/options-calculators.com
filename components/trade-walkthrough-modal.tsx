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

// P6-13. This file was 865 lines. The per-strategy flow table, the setup-string
// parser and the broker-screen mockups are now in `components/walkthrough/`,
// unchanged.
import { DEFAULT_FLOW, STRATEGY_FLOWS, type Leg, type StrategyFlow } from "@/components/walkthrough/strategy-flows"
import { parseSetup } from "@/components/walkthrough/parse-setup"
import type { CoachKind, CoachLine, ScreenKind, WalkStep, WalkthroughSetup } from "@/components/walkthrough/walkthrough-types"
// Re-exported so every existing importer of this module keeps working.
export type { WalkthroughSetup }
import {
  Annotation,
  CoachBubble,
  LegList,
  ScreenFrame,
  ScreenMockup,
} from "@/components/walkthrough/mockup"

interface TradeWalkthroughModalProps {
  open: boolean
  onClose: () => void
  setup: WalkthroughSetup | null
  strategyKey?: string
  strategyName: string
  typicalDTE?: string
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
