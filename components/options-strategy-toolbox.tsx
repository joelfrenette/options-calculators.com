"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, Target, DollarSign, Clock, Loader2, Shield, BarChart2, Activity } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { Calculator, RefreshCw } from "lucide-react" // Added imports for Calculator and RefreshCw

// Strategy configurations
const STRATEGIES = {
  "credit-spreads": {
    name: "Credit Spreads",
    tagline: "Collect Premium with Defined Risk",
    badge: "Income Strategy",
    badgeColor: "bg-green-100 text-green-800",
    stats: {
      maxProfit: "Credit Received",
      maxLoss: "Spread Width – Credit",
      probability: "65–80%",
      bestMarket: "Directional bias, moderate IV",
      idealIV: ">40",
      typicalDTE: "30–45 days",
      breakeven: "Strike ± Credit",
    },
    payoff: generateCreditSpreadPayoff(),
    setups: [
      {
        ticker: "SPY",
        setup: "545/540 Put Credit Spread",
        credit: "$2.15",
        pop: "72%",
        direction: "Bullish",
        signal: "Strong",
      },
      {
        ticker: "QQQ",
        setup: "470/465 Put Credit Spread",
        credit: "$1.85",
        pop: "68%",
        direction: "Bullish",
        signal: "Moderate",
      },
      {
        ticker: "IWM",
        setup: "220/225 Call Credit Spread",
        credit: "$1.95",
        pop: "70%",
        direction: "Bearish",
        signal: "Weak",
      },
    ],
    insights: {
      outlook:
        "With VIX at elevated levels and markets showing consolidation, credit spreads offer attractive risk/reward. Focus on put credit spreads if you're moderately bullish, or call credit spreads for bearish exposure. Current IV rank above 50 makes premium collection favorable.",
      entryRules: [
        "Only enter when IV Rank > 40",
        "Sell the short strike at 30 delta or less",
        "Collect at least 1/3 of spread width as credit",
        "Avoid earnings week unless intentional",
        "Check for upcoming catalysts (Fed meetings, data releases)",
      ],
      adjustments: [
        "Close at 50% profit to lock in gains",
        "If tested, roll down/up and out for credit",
        "Close if spread reaches 2x credit received",
        "Consider adding opposite spread to create Iron Condor if directionally wrong",
      ],
    },
  },
  "iron-condors": {
    name: "Iron Condors",
    tagline: "The King of High-Probability Income Trades",
    badge: "Income Strategy",
    badgeColor: "bg-green-100 text-green-800",
    stats: {
      maxProfit: "Net Credit Received",
      maxLoss: "Wing Width – Credit",
      probability: "70–85%",
      bestMarket: "Range-bound, high IV",
      idealIV: ">50",
      typicalDTE: "30–60 days",
      breakeven: "±8–12% from current price",
    },
    payoff: generateIronCondorPayoff(),
    setups: [
      {
        ticker: "SPY",
        setup: "550/545 – 580/585",
        credit: "$3.20",
        pop: "78%",
        direction: "Neutral",
        signal: "Strong",
      },
      {
        ticker: "QQQ",
        setup: "460/455 – 490/495",
        credit: "$2.85",
        pop: "75%",
        direction: "Neutral",
        signal: "Moderate",
      },
      { ticker: "IWM", setup: "210/205 – 230/235", credit: "$2.40", pop: "76%", direction: "Neutral", signal: "Weak" },
    ],
    insights: {
      outlook:
        "Iron Condors thrive in range-bound markets with elevated implied volatility. Current market conditions show VIX above historical average, making premium rich. SPY has been consolidating between key support and resistance levels, ideal for this strategy.",
      entryRules: [
        "Only enter when IV Rank > 50",
        "Short strikes at 16 delta or less (1 standard deviation)",
        "Wing width of $5 for SPY/QQQ, $2.50 for smaller ETFs",
        "Collect at least 1/3 of wing width as credit",
        "Avoid major news events within the trade duration",
      ],
      adjustments: [
        "Close at 50% profit – don't get greedy",
        "If one side tested, roll untested side closer",
        "If breached, close tested side, keep untested",
        "Consider rolling out in time if still in expected range",
      ],
    },
  },
  "calendar-spreads": {
    name: "Calendar Spreads",
    tagline: "Profit from Time Decay Differential",
    badge: "Time Decay Play",
    badgeColor: "bg-blue-100 text-blue-800",
    stats: {
      maxProfit: "Varies (at short strike at expiration)",
      maxLoss: "Net Debit Paid",
      probability: "50–65%",
      bestMarket: "Low IV, expecting IV rise",
      idealIV: "<30 (buying low IV)",
      typicalDTE: "Front: 30 days, Back: 60+ days",
      breakeven: "Near short strike price",
    },
    payoff: generateCalendarPayoff(),
    setups: [
      {
        ticker: "AAPL",
        setup: "190 Call Calendar (Dec/Jan)",
        credit: "$3.50 debit",
        pop: "55%",
        direction: "Neutral",
        signal: "Strong",
      },
      {
        ticker: "MSFT",
        setup: "420 Put Calendar (Dec/Jan)",
        credit: "$4.20 debit",
        pop: "52%",
        direction: "Neutral",
        signal: "Moderate",
      },
      {
        ticker: "NVDA",
        setup: "480 Call Calendar (Dec/Jan)",
        credit: "$8.50 debit",
        pop: "50%",
        direction: "Neutral",
        signal: "Weak",
      },
    ],
    insights: {
      outlook:
        "Calendar spreads benefit when IV is low and expected to rise. With current IV percentile below 30 on many tech names, calendars offer attractive risk/reward. Best positioned on stocks expected to stay range-bound short-term but move later.",
      entryRules: [
        "Enter when IV Rank < 30 (buying cheap IV)",
        "Choose strikes near current stock price (ATM)",
        "Front month 20-30 DTE, back month 50-60 DTE",
        "Avoid earnings between expiration dates",
        "Look for stocks in consolidation patterns",
      ],
      adjustments: [
        "Close at 25-50% profit",
        "If stock moves significantly, close or roll",
        "Can convert to diagonal if directional bias develops",
        "Roll front month if still at target price",
      ],
    },
  },
  butterflies: {
    name: "Butterfly Spreads",
    tagline: "Precise Strike, Maximum Reward-to-Risk",
    badge: "Precision Strategy",
    badgeColor: "bg-purple-100 text-purple-800",
    stats: {
      maxProfit: "Wing Width – Debit (at middle strike)",
      maxLoss: "Net Debit Paid",
      probability: "30–50%",
      bestMarket: "Expecting pin to specific price",
      idealIV: ">40 (selling expensive middle)",
      typicalDTE: "14–30 days",
      breakeven: "Middle Strike ± Debit",
    },
    payoff: generateButterflyPayoff(),
    setups: [
      {
        ticker: "SPY",
        setup: "565/570/575 Call Butterfly",
        credit: "$1.20 debit",
        pop: "35%",
        direction: "Bullish Target",
        signal: "Strong",
      },
      {
        ticker: "TSLA",
        setup: "240/250/260 Put Butterfly",
        credit: "$2.50 debit",
        pop: "32%",
        direction: "Bearish Target",
        signal: "Moderate",
      },
      {
        ticker: "AMD",
        setup: "135/140/145 Call Butterfly",
        credit: "$1.80 debit",
        pop: "38%",
        direction: "Bullish Target",
        signal: "Weak",
      },
    ],
    insights: {
      outlook:
        "Butterflies offer exceptional reward-to-risk when you have a price target. With upcoming options expiration and key support/resistance levels identified, positioned butterflies around expected pin prices can yield 3-5x returns.",
      entryRules: [
        "Have a specific price target (middle strike)",
        "Enter 2-3 weeks before expiration",
        "Risk only 1-2% of portfolio per butterfly",
        "Use wide wings for higher probability, narrow for higher payout",
        "Consider broken-wing butterflies for directional bias",
      ],
      adjustments: [
        "Close at 50% profit or better",
        "If target changes, close and reposition",
        "Can add butterflies at different strikes to widen range",
        "Close if underlying moves beyond wing strikes",
      ],
    },
  },
  collars: {
    name: "Collars",
    tagline: "Insurance for Your Stock Positions",
    badge: "Hedged Strategy",
    badgeColor: "bg-yellow-100 text-yellow-800",
    stats: {
      maxProfit: "Call Strike – Stock Price + Put Premium",
      maxLoss: "Stock Price – Put Strike – Net Premium",
      probability: "High protection, capped upside",
      bestMarket: "Uncertain, want protection",
      idealIV: "Any (hedging priority)",
      typicalDTE: "30–90 days",
      breakeven: "Stock price ± net premium",
    },
    payoff: generateCollarPayoff(),
    setups: [
      {
        ticker: "AAPL",
        setup: "Buy 185 Put, Sell 200 Call",
        credit: "$0.50 credit",
        pop: "Protected",
        direction: "Hedge Long",
        signal: "Strong",
      },
      {
        ticker: "NVDA",
        setup: "Buy 460 Put, Sell 520 Call",
        credit: "$2.00 debit",
        pop: "Protected",
        direction: "Hedge Long",
        signal: "Moderate",
      },
      {
        ticker: "MSFT",
        setup: "Buy 400 Put, Sell 440 Call",
        credit: "$0.80 credit",
        pop: "Protected",
        direction: "Hedge Long",
        signal: "Weak",
      },
    ],
    insights: {
      outlook:
        "With market uncertainty and your profitable long positions, collars provide sleep-at-night protection. Sell calls to finance protective puts. Ideal before earnings, Fed meetings, or when you want to lock in gains while maintaining upside participation.",
      entryRules: [
        "Only collar positions you're willing to be called away from",
        "Put strike at your 'must protect' level",
        "Call strike at price you'd happily sell",
        "Try to structure for zero cost or small credit",
        "Consider rolling calls if stock rises toward strike",
      ],
      adjustments: [
        "Roll call up and out if stock rallies (to capture more upside)",
        "Roll put down and out if stock consolidates above put",
        "Remove collar if outlook becomes strongly bullish",
        "Add to collar if protection needs increase",
      ],
    },
  },
  diagonals: {
    name: "Diagonal Spreads",
    tagline: "Calendar Meets Vertical for Directional Edge",
    badge: "Directional Income",
    badgeColor: "bg-indigo-100 text-indigo-800",
    stats: {
      maxProfit: "Complex (time + directional move)",
      maxLoss: "Net Debit Paid",
      probability: "55–70%",
      bestMarket: "Slow directional move expected",
      idealIV: "Buy low IV back month, sell high IV front",
      typicalDTE: "Front: 30 days, Back: 60-90 days",
      breakeven: "Varies by strikes and time",
    },
    payoff: generateDiagonalPayoff(),
    setups: [
      {
        ticker: "GOOGL",
        setup: "Buy Jan 175C, Sell Dec 180C",
        credit: "$4.20 debit",
        pop: "62%",
        direction: "Bullish",
        signal: "Strong",
      },
      {
        ticker: "META",
        setup: "Buy Jan 560C, Sell Dec 580C",
        credit: "$8.50 debit",
        pop: "58%",
        direction: "Bullish",
        signal: "Moderate",
      },
      {
        ticker: "AMZN",
        setup: "Buy Jan 200P, Sell Dec 195P",
        credit: "$3.80 debit",
        pop: "60%",
        direction: "Bearish",
        signal: "Weak",
      },
    ],
    insights: {
      outlook:
        "Diagonals combine the best of calendars and verticals. Buy a longer-dated option and sell shorter-dated options against it repeatedly. Ideal for slow, grinding directional moves. Current low volatility makes buying back-month options attractive.",
      entryRules: [
        "Buy back-month option ITM or ATM",
        "Sell front-month option OTM in direction of bias",
        "Aim to collect 30-50% of back-month cost in first front sale",
        "Choose liquid underlyings for easy adjustments",
        "Avoid earnings in front month cycle",
      ],
      adjustments: [
        "Roll front-month option when it loses 50% value",
        "Adjust front strike as underlying moves",
        "Close entire position at 50% profit on debit",
        "Convert to vertical if big move expected",
      ],
    },
  },
  "straddles-strangles": {
    name: "Straddles & Strangles",
    tagline: "Profit from Big Moves in Either Direction",
    badge: "Volatility Play",
    badgeColor: "bg-red-100 text-red-800",
    stats: {
      maxProfit: "Unlimited (big move either direction)",
      maxLoss: "Total Premium Paid",
      probability: "35–50%",
      bestMarket: "Expecting big move, low IV",
      idealIV: "<30 (buying cheap volatility)",
      typicalDTE: "30–60 days",
      breakeven: "Strike ± Total Premium (straddle)",
    },
    payoff: generateStraddlePayoff(),
    setups: [
      {
        ticker: "TSLA",
        setup: "250 Straddle (Dec)",
        credit: "$18.00 debit",
        pop: "42%",
        direction: "Big Move",
        signal: "Strong",
      },
      {
        ticker: "NVDA",
        setup: "475/485 Strangle (Dec)",
        credit: "$12.50 debit",
        pop: "45%",
        direction: "Big Move",
        signal: "Moderate",
      },
      {
        ticker: "COIN",
        setup: "280 Straddle (Dec)",
        credit: "$22.00 debit",
        pop: "40%",
        direction: "Big Move",
        signal: "Weak",
      },
    ],
    insights: {
      outlook:
        "Buy volatility when it's cheap and a catalyst approaches. With IV rank low on several names ahead of earnings or major events, long straddles/strangles can profit from the expected IV expansion and price movement. Choose stocks known for big moves.",
      entryRules: [
        "Only buy when IV Rank < 30",
        "Must have identified catalyst (earnings, FDA, etc.)",
        "Straddle for maximum gamma, strangle for lower cost",
        "Size positions knowing max loss is 100% of premium",
        "Enter 1-2 weeks before expected catalyst",
      ],
      adjustments: [
        "Sell half if one side doubles (free ride remaining)",
        "Close before catalyst if IV expansion gives profit",
        "Can convert to ratio spread if directional bias develops",
        "Close losing side early if move is clearly one-directional",
      ],
    },
  },
  "wheel-strategy": {
    name: "The Wheel Strategy",
    tagline: "Systematic Income from Stocks You Want to Own",
    badge: "Premium Strategy",
    badgeColor: "bg-emerald-100 text-emerald-800",
    stats: {
      maxProfit: "Continuous premium + stock appreciation",
      maxLoss: "Stock goes to zero (like owning stock)",
      probability: "High income, varies on capital gains",
      bestMarket: "Neutral to bullish on quality stocks",
      idealIV: ">30 (better premium)",
      typicalDTE: "30–45 days per cycle",
      breakeven: "Put strike – cumulative premiums",
    },
    payoff: generateWheelPayoff(),
    setups: [
      {
        ticker: "AMD",
        setup: "Sell 130 Put (30 DTE)",
        credit: "$2.80",
        pop: "75%",
        direction: "Wheel Entry",
        signal: "Strong",
      },
      {
        ticker: "SOFI",
        setup: "Sell 14 Put (30 DTE)",
        credit: "$0.45",
        pop: "72%",
        direction: "Wheel Entry",
        signal: "Moderate",
      },
      {
        ticker: "PLTR",
        setup: "Sell 65 Put (30 DTE)",
        credit: "$1.90",
        pop: "70%",
        direction: "Wheel Entry",
        signal: "Weak",
      },
    ],
    insights: {
      outlook:
        "The Wheel is the ultimate 'get paid to wait' strategy. Sell cash-secured puts on stocks you'd happily own at lower prices. If assigned, sell covered calls until called away. Rinse and repeat for consistent income on quality names.",
      entryRules: [
        "Only wheel stocks you'd own long-term",
        "Sell puts at price you'd gladly buy (support levels)",
        "Target 1-2% premium per month",
        "Have cash secured for potential assignment",
        "Start with high-quality, liquid names",
      ],
      adjustments: [
        "Roll puts down and out if tested (avoid assignment at poor prices)",
        "If assigned, immediately sell covered calls",
        "Sell calls above cost basis to ensure profit if called",
        "Roll calls up and out if stock rallies (capture more upside)",
      ],
    },
  },
}

// Payoff diagram generators
function generateCreditSpreadPayoff() {
  return Array.from({ length: 50 }, (_, i) => {
    const x = i - 25
    let y
    if (x < -10) y = -5
    else if (x < 0) y = -5 + (x + 10) * 0.7
    else y = 2
    return { x: x + 550, y, breakeven: x === -7 }
  })
}

function generateIronCondorPayoff() {
  return Array.from({ length: 60 }, (_, i) => {
    const x = i - 30
    let y
    if (x < -15) y = -5
    else if (x < -8) y = -5 + (x + 15) * 0.7
    else if (x < 8) y = 3
    else if (x < 15) y = 3 - (x - 8) * 0.7
    else y = -5
    return { x: x + 565, y }
  })
}

function generateCalendarPayoff() {
  return Array.from({ length: 50 }, (_, i) => {
    const x = i - 25
    const y = 3 * Math.exp((-x * x) / 100) - 1
    return { x: x + 190, y }
  })
}

function generateButterflyPayoff() {
  return Array.from({ length: 50 }, (_, i) => {
    const x = i - 25
    let y
    if (x < -10) y = -1
    else if (x < 0) y = -1 + (x + 10) * 0.4
    else if (x < 10) y = 3 - x * 0.4
    else y = -1
    return { x: x + 570, y }
  })
}

function generateCollarPayoff() {
  return Array.from({ length: 50 }, (_, i) => {
    const x = i - 25
    let y
    if (x < -10) y = -8
    else if (x < 10) y = x * 0.8
    else y = 8
    return { x: x + 190, y }
  })
}

function generateDiagonalPayoff() {
  return Array.from({ length: 50 }, (_, i) => {
    const x = i - 25
    const y = 2 * Math.exp((-(x - 5) * (x - 5)) / 150) - 0.5
    return { x: x + 175, y }
  })
}

function generateStraddlePayoff() {
  return Array.from({ length: 50 }, (_, i) => {
    const x = i - 25
    const y = Math.abs(x) * 0.5 - 8
    return { x: x + 250, y }
  })
}

function generateWheelPayoff() {
  return Array.from({ length: 50 }, (_, i) => {
    const x = i - 25
    let y
    if (x < -5) y = x + 5
    else y = 2 + Math.sin(x / 5) * 0.5
    return { x: x + 130, y }
  })
}

interface OptionsStrategyToolboxProps {
  strategy: keyof typeof STRATEGIES
}

export function OptionsStrategyToolbox({ strategy }: OptionsStrategyToolboxProps) {
  const config = STRATEGIES[strategy]

  const [setups, setSetups] = useState(config?.setups || [])
  const [isScanning, setIsScanning] = useState(false)
  const [lastScanned, setLastScanned] = useState<Date | null>(null)

  if (!config) {
    return <div className="p-8 text-center text-gray-500">Strategy not found</div>
  }

  const handleRefreshSetups = async () => {
    setIsScanning(true)
    try {
      const response = await fetch("/api/strategy-scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, strategyName: config.name }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.setups && data.setups.length > 0) {
          setSetups(data.setups)
          setLastScanned(new Date())
        }
      }
    } catch (error) {
      console.error("Error scanning for setups:", error)
    } finally {
      setIsScanning(false)
    }
  }

  const getPayoffChartData = (payoffData: { x: number; y: number }[]) => {
    return payoffData.map((point) => ({
      x: point.x,
      profit: point.y > 0 ? point.y : 0,
      loss: point.y < 0 ? point.y : 0,
      y: point.y,
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-sky-100 to-teal-50 border-b border-sky-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold text-navy-900" style={{ color: "#1E3A8A" }}>
                  {config.name}
                </h1>
                <Badge className={config.badgeColor}>{config.badge}</Badge>
              </div>
              <p className="text-lg text-teal-700">{config.tagline}</p>
            </div>
            <div className="flex items-center gap-2">
              <RefreshButton onClick={handleRefreshSetups} disabled={isScanning} />
              <TooltipsToggle />
            </div>
          </div>
          {lastScanned && (
            <p className="text-xs text-teal-600 mt-2">Last scanned: {lastScanned.toLocaleTimeString()}</p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Main Content: Payoff Diagram + Stats */}
        <div className="grid lg:grid-cols-5 gap-6 mb-8">
          {/* Payoff Diagram */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Payoff Diagram</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={getPayoffChartData(config.payoff)}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="x" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v > 0 ? `+${v}` : v)} />
                    <ReferenceLine y={0} stroke="#9CA3AF" strokeWidth={2} />
                    <defs>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="#EF4444" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="none"
                      fill="url(#profitGradient)"
                      fillOpacity={1}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="loss"
                      stroke="none"
                      fill="url(#lossGradient)"
                      fillOpacity={1}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="y"
                      stroke="#374151"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span>Profit Zone</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded" />
                  <span>Loss Zone</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Stats */}
          <Card className="lg:col-span-3 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold" style={{ color: "#1E3A8A" }}>
                Strategy Characteristics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-green-700 mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs font-medium">Max Profit</span>
                  </div>
                  <p className="text-sm font-semibold text-green-900">{config.stats.maxProfit}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 text-red-700 mb-1">
                    <Shield className="h-4 w-4" />
                    <span className="text-xs font-medium">Max Loss</span>
                  </div>
                  <p className="text-sm font-semibold text-red-900">{config.stats.maxLoss}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-700 mb-1">
                    <Target className="h-4 w-4" />
                    <span className="text-xs font-medium">Probability of Profit</span>
                  </div>
                  <p className="text-sm font-semibold text-blue-900">{config.stats.probability}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 text-purple-700 mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs font-medium">Best Market</span>
                  </div>
                  <p className="text-sm font-semibold text-purple-900">{config.stats.bestMarket}</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 text-orange-700 mb-1">
                    <Activity className="h-4 w-4" />
                    <span className="text-xs font-medium">Ideal IV Rank</span>
                  </div>
                  <p className="text-sm font-semibold text-orange-900">{config.stats.idealIV}</p>
                </div>
                <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                  <div className="flex items-center gap-2 text-teal-700 mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-medium">Typical DTE</span>
                  </div>
                  <p className="text-sm font-semibold text-teal-900">{config.stats.typicalDTE}</p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-700 mb-1">
                  <Calculator className="h-4 w-4 mr-2" />
                  <span className="text-xs font-medium">Breakeven</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{config.stats.breakeven}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Best Current Setups */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-8 bg-teal-500 rounded" />
            <h2 className="text-xl font-bold" style={{ color: "#1E3A8A" }}>
              Best Current Setups This Week
            </h2>
            {isScanning && (
              <Badge className="bg-teal-100 text-teal-700 ml-2">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                AI Scanning Markets...
              </Badge>
            )}
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {setups.map((setup, idx) => (
              <Card
                key={idx}
                className={`shadow-md hover:shadow-lg transition-shadow ${isScanning ? "opacity-50" : ""}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl font-bold" style={{ color: "#1E3A8A" }}>
                      {setup.ticker}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {setup.direction}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 mb-3 font-medium">{setup.setup}</p>
                  <div className="flex justify-between text-sm mb-4">
                    <div>
                      <span className="text-gray-500">Premium:</span>
                      <span className="ml-1 font-semibold text-green-600">{setup.credit}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">POP:</span>
                      <span className="ml-1 font-semibold text-blue-600">{setup.pop}</span>
                    </div>
                  </div>
                  {/* TooltipProvider added here */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button className="w-full text-white bg-[#0D9488] hover:bg-[#0F766E]">Run Scenario</Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {setup.setup} on {setup.ticker}. Premium: {setup.credit}, Probability of Profit: {setup.pop}.
                          Signal strength: {setup.signal}.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* AI Trade Ideas */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-8 bg-teal-500 rounded" />
            <h2 className="text-xl font-bold" style={{ color: "#1E3A8A" }}>
              <BarChart2 className="h-5 w-5 inline mr-2 text-teal-600" />
              AI Trade Ideas & Adjustments This Week
            </h2>
          </div>
          <div className="space-y-3">
            <div className="border rounded-lg shadow-sm bg-white">
              <div className="px-4 py-3 hover:no-underline">
                <span className="font-semibold" style={{ color: "#1E3A8A" }}>
                  Market Outlook Impact
                </span>
              </div>
              <div className="px-4 pb-4">
                <p className="text-gray-700 leading-relaxed">{config.insights.outlook}</p>
              </div>
            </div>
            <div className="border rounded-lg shadow-sm bg-white">
              <div className="px-4 py-3 hover:no-underline">
                <span className="font-semibold" style={{ color: "#1E3A8A" }}>
                  Entry Rules I'm Using
                </span>
              </div>
              <div className="px-4 pb-4">
                <ul className="space-y-2">
                  {config.insights.entryRules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-700">
                      <span className="text-teal-500 mt-1">•</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="border rounded-lg shadow-sm bg-white">
              <div className="px-4 py-3 hover:no-underline">
                <span className="font-semibold" style={{ color: "#1E3A8A" }}>
                  Adjustment Triggers
                </span>
              </div>
              <div className="px-4 pb-4">
                <ul className="space-y-2">
                  {config.insights.adjustments.map((adj, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-700">
                      <span className="text-teal-500 mt-1">•</span>
                      {adj}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="rounded-xl p-6 text-center relative overflow-hidden" style={{ backgroundColor: "#CCFBF1" }}>
          <div className="relative z-10">
            <RefreshCw className="h-10 w-10 mx-auto mb-3 text-teal-600" />
            <p className="text-lg font-semibold" style={{ color: "#1E3A8A" }}>
              Master every strategy with precision — calculate, execute, win.
            </p>
            <p className="text-sm text-teal-700 mt-2">
              Use our professional-grade calculators to optimize your {config.name.toLowerCase()} trades.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
