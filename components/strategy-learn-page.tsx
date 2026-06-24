"use client"

// Reusable "teach a strategy" layout used by the dedicated LEARN pages
// (CSP, CC, LEAPS, PMCC, and future strategy-specific lessons).
//
// Design goals (user direction):
// - Grade-12 reading level: short sentences, plain language, one idea per line.
// - Real examples with concrete numbers ($X stock, $Y strike, $Z premium).
// - Payoff diagram done in pure SVG so the math is auditable in this file
//   (no hidden chart-library magic). All formulas are canonical Black-Scholes
//   payoff lines — see PayoffDiagram below.

import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Info, TrendingUp, TrendingDown, AlertTriangle, Check, ArrowRight, BookOpen } from "lucide-react"

export type Bias = "bullish" | "bearish" | "neutral" | "neutral-to-bullish" | "neutral-to-bearish"
export type Complexity = "Beginner" | "Intermediate" | "Advanced"

const BIAS_COLOR: Record<Bias, string> = {
  bullish: "bg-emerald-100 text-emerald-800 border-emerald-300",
  bearish: "bg-red-100 text-red-800 border-red-300",
  neutral: "bg-slate-100 text-slate-700 border-slate-300",
  "neutral-to-bullish": "bg-blue-100 text-blue-800 border-blue-300",
  "neutral-to-bearish": "bg-amber-100 text-amber-800 border-amber-300",
}

const COMPLEXITY_COLOR: Record<Complexity, string> = {
  Beginner: "bg-green-100 text-green-800 border-green-300",
  Intermediate: "bg-amber-100 text-amber-800 border-amber-300",
  Advanced: "bg-red-100 text-red-800 border-red-300",
}

// ---------------------------------------------------------------------------
// Payoff diagram — pure SVG. Caller provides a payoff(price) function that
// returns dollars of P&L at expiration. We sample across a price range and
// draw the line plus annotations for breakeven / max profit / max loss.
// ---------------------------------------------------------------------------
export interface PayoffDiagramProps {
  payoff: (priceAtExpiration: number) => number
  minPrice: number
  maxPrice: number
  breakevens?: number[] // vertical guide lines
  currentPrice?: number // optional vertical guide
  // Reference levels to annotate on the y-axis (e.g. max profit, max loss).
  maxProfit?: number | "unlimited"
  maxLoss?: number | "unlimited"
  // Optional strike markers
  strikes?: Array<{ price: number; label: string }>
}

export function PayoffDiagram({
  payoff,
  minPrice,
  maxPrice,
  breakevens,
  currentPrice,
  maxProfit,
  maxLoss,
  strikes,
}: PayoffDiagramProps) {
  // Sample 200 points across the price range for a smooth curve.
  const samples = 200
  const points: Array<{ price: number; pnl: number }> = []
  for (let i = 0; i <= samples; i++) {
    const price = minPrice + ((maxPrice - minPrice) * i) / samples
    points.push({ price, pnl: payoff(price) })
  }
  const pnls = points.map((p) => p.pnl)
  const yMinRaw = Math.min(...pnls)
  const yMaxRaw = Math.max(...pnls)
  // Pad so the zero line is visible and curves don't touch frame.
  const pad = Math.max(50, (yMaxRaw - yMinRaw) * 0.15)
  const yMin = Math.min(yMinRaw - pad, -pad / 2)
  const yMax = Math.max(yMaxRaw + pad, pad / 2)

  // SVG coords: 800x320 viewBox.
  const W = 800
  const H = 320
  const PAD_L = 60
  const PAD_R = 18
  const PAD_T = 16
  const PAD_B = 36
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B

  const x = (price: number) => PAD_L + ((price - minPrice) / (maxPrice - minPrice)) * plotW
  const y = (pnl: number) => PAD_T + (1 - (pnl - yMin) / (yMax - yMin)) * plotH

  // Build the polyline path (positive in green, negative in red).
  const pathPos: string[] = []
  const pathNeg: string[] = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const cmd = `${i === 0 ? "M" : "L"} ${x(p.price).toFixed(1)} ${y(p.pnl).toFixed(1)}`
    if (p.pnl >= 0) pathPos.push(cmd)
    else pathNeg.push(cmd)
  }
  const zeroY = y(0)

  // Y-axis tick values
  const yTicks = [yMin, yMin / 2, 0, yMax / 2, yMax].map((v) => Math.round(v))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Payoff diagram">
      {/* Grid */}
      <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} fill="#fafafa" stroke="#e5e7eb" />
      {yTicks.map((v) => (
        <g key={`yt-${v}`}>
          <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="#e5e7eb" strokeDasharray="2 2" />
          <text x={PAD_L - 6} y={y(v) + 4} textAnchor="end" className="fill-slate-500 text-[10px]">
            {v >= 0 ? `+$${v}` : `-$${Math.abs(v)}`}
          </text>
        </g>
      ))}

      {/* Zero line (strong) */}
      <line x1={PAD_L} x2={W - PAD_R} y1={zeroY} y2={zeroY} stroke="#94a3b8" strokeWidth={1.5} />

      {/* Strike markers */}
      {strikes?.map((s) => (
        <g key={`strike-${s.price}-${s.label}`}>
          <line
            x1={x(s.price)}
            x2={x(s.price)}
            y1={PAD_T}
            y2={H - PAD_B}
            stroke="#cbd5e1"
            strokeDasharray="3 3"
          />
          <text x={x(s.price)} y={PAD_T - 4} textAnchor="middle" className="fill-slate-600 text-[10px] font-medium">
            {s.label} ${s.price}
          </text>
        </g>
      ))}

      {/* Breakevens */}
      {breakevens?.map((b) => (
        <g key={`be-${b}`}>
          <line x1={x(b)} x2={x(b)} y1={PAD_T} y2={H - PAD_B} stroke="#0ea5e9" strokeWidth={1.5} />
          <text x={x(b) + 4} y={H - PAD_B + 14} className="fill-sky-700 text-[10px] font-semibold">
            BE ${Math.round(b)}
          </text>
        </g>
      ))}

      {/* Current price */}
      {currentPrice !== undefined && (
        <g>
          <line
            x1={x(currentPrice)}
            x2={x(currentPrice)}
            y1={PAD_T}
            y2={H - PAD_B}
            stroke="#f59e0b"
            strokeWidth={2}
          />
          <text x={x(currentPrice) + 4} y={PAD_T + 12} className="fill-amber-700 text-[10px] font-semibold">
            Now ${Math.round(currentPrice)}
          </text>
        </g>
      )}

      {/* P&L curves */}
      {pathPos.length > 0 && (
        <path d={pathPos.join(" ")} fill="none" stroke="#10b981" strokeWidth={2.5} />
      )}
      {pathNeg.length > 0 && (
        <path d={pathNeg.join(" ")} fill="none" stroke="#ef4444" strokeWidth={2.5} />
      )}

      {/* X-axis price labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const price = minPrice + (maxPrice - minPrice) * f
        return (
          <text
            key={`x-${f}`}
            x={x(price)}
            y={H - PAD_B + 28}
            textAnchor="middle"
            className="fill-slate-500 text-[10px]"
          >
            ${Math.round(price)}
          </text>
        )
      })}
      <text x={W / 2} y={H - 4} textAnchor="middle" className="fill-slate-700 text-[11px] font-medium">
        Stock price at expiration
      </text>

      {/* Profit / Loss caps */}
      {typeof maxProfit === "number" && (
        <text x={W - PAD_R - 4} y={y(maxProfit) - 4} textAnchor="end" className="fill-emerald-700 text-[10px] font-semibold">
          Max profit ${maxProfit}
        </text>
      )}
      {typeof maxLoss === "number" && (
        <text x={W - PAD_R - 4} y={y(-Math.abs(maxLoss)) + 12} textAnchor="end" className="fill-red-700 text-[10px] font-semibold">
          Max loss ${maxLoss}
        </text>
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Page layout
// ---------------------------------------------------------------------------
export interface StrategyLearnPageProps {
  title: string
  shortName?: string // optional acronym like "CSP"
  oneLiner: string // single sentence summary
  bias: Bias
  complexity: Complexity
  prerequisites?: string[] // e.g. ["The Wheel uses both CSPs and Covered Calls"]
  whatItIs: string // 2-3 sentences plain language
  steps: string[] // numbered "how it works" steps
  payoff: PayoffDiagramProps
  formulas: Array<{ label: string; value: string; tone?: "good" | "bad" | "neutral" }>
  whenToUse: string[]
  risks: string[]
  example: {
    setup: string
    walkthrough: string[]
    outcome: string
  }
  relatedTools?: Array<{ label: string; description: string }>
}

export function StrategyLearnPage(props: StrategyLearnPageProps) {
  const { title, shortName, oneLiner, bias, complexity, prerequisites } = props
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-100 rounded-lg p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-emerald-600" /> {title}
              {shortName && <span className="text-base font-mono text-slate-500">({shortName})</span>}
            </h1>
            <p className="text-slate-700 mt-1.5 text-base">{oneLiner}</p>
          </div>
          <div className="flex flex-col gap-1 items-end shrink-0">
            <Badge variant="outline" className={`text-xs ${BIAS_COLOR[bias]}`}>
              Bias: {bias}
            </Badge>
            <Badge variant="outline" className={`text-xs ${COMPLEXITY_COLOR[complexity]}`}>
              {complexity}
            </Badge>
          </div>
        </div>
        {prerequisites && prerequisites.length > 0 && (
          <div className="mt-3 text-xs text-slate-600 inline-flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>Before this:</strong> {prerequisites.join(" • ")}
            </span>
          </div>
        )}
      </div>

      {/* What it is */}
      <Card className="bg-white">
        <CardContent className="pt-5">
          <h2 className="text-lg font-bold text-slate-900 mb-2">What it is</h2>
          <p className="text-slate-700 leading-relaxed">{props.whatItIs}</p>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="bg-white">
        <CardContent className="pt-5">
          <h2 className="text-lg font-bold text-slate-900 mb-3">How it works</h2>
          <ol className="space-y-2 list-none">
            {props.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-none h-6 w-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-slate-700 leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Payoff diagram */}
      <Card className="bg-white">
        <CardContent className="pt-5">
          <h2 className="text-lg font-bold text-slate-900 mb-2">Payoff diagram</h2>
          <p className="text-xs text-slate-600 mb-3">
            Green line = you make money. Red line = you lose money. The y-axis shows your profit or loss per contract
            at expiration. The x-axis shows what the stock price could be at expiration.
          </p>
          <div className="bg-white border border-slate-200 rounded-md p-2">
            <PayoffDiagram {...props.payoff} />
          </div>
        </CardContent>
      </Card>

      {/* Formulas */}
      <Card className="bg-white">
        <CardContent className="pt-5">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Key formulas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {props.formulas.map((f, i) => {
              const toneClass =
                f.tone === "good"
                  ? "border-emerald-200 bg-emerald-50"
                  : f.tone === "bad"
                    ? "border-red-200 bg-red-50"
                    : "border-slate-200 bg-slate-50"
              return (
                <div key={i} className={`rounded border p-3 ${toneClass}`}>
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{f.label}</div>
                  <div className="font-mono text-sm text-slate-900 mt-1">{f.value}</div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* When to use + Risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-white border-emerald-200">
          <CardContent className="pt-5">
            <h2 className="text-base font-bold text-emerald-700 mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> When to use
            </h2>
            <ul className="space-y-1.5">
              {props.whenToUse.map((w, i) => (
                <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="bg-white border-red-200">
          <CardContent className="pt-5">
            <h2 className="text-base font-bold text-red-700 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Risks
            </h2>
            <ul className="space-y-1.5">
              {props.risks.map((r, i) => (
                <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                  <TrendingDown className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Real example */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-5">
          <h2 className="text-lg font-bold text-blue-900 mb-2">A real example</h2>
          <p className="text-sm text-blue-900 mb-2">
            <strong>Setup:</strong> {props.example.setup}
          </p>
          <ol className="space-y-1.5 list-decimal list-inside text-sm text-slate-800 mb-3">
            {props.example.walkthrough.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ol>
          <p className="text-sm text-blue-900">
            <strong>Result:</strong> {props.example.outcome}
          </p>
        </CardContent>
      </Card>

      {/* Related tools */}
      {props.relatedTools && props.relatedTools.length > 0 && (
        <Card className="bg-white">
          <CardContent className="pt-5">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Try it with our tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {props.relatedTools.map((t, i) => (
                <div key={i} className="flex items-start gap-2 border border-slate-200 rounded p-2.5">
                  <ArrowRight className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <div className="font-semibold text-slate-900">{t.label}</div>
                    <div className="text-xs text-slate-600">{t.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer caveat */}
      <p className="text-xs text-slate-500 italic">
        Educational only — not investment advice. Options involve risk; you can lose more than you invest on some
        strategies. Practice with paper trading before risking real money.
      </p>
    </div>
  )
}

// Re-export ReactNode type (helps TS in caller files if needed)
export type { ReactNode }
