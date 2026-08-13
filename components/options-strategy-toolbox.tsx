"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import {
  DollarSign,
  Shield,
  Target,
  TrendingUp,
  Activity,
  Clock,
  Calculator,
  RefreshCw,
  BarChart2,
  Info,
} from "lucide-react"
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { TradeWalkthroughModal, type WalkthroughSetup } from "@/components/trade-walkthrough-modal"
// P6-13. This file was 1,026 lines, 480 of them the strategy copy table and 135
// the payoff maths. Both are now in `components/toolbox/`, unchanged.
import { STRATEGIES } from "@/components/toolbox/strategies"


// Strategy configurations
interface StrategySetup {
  ticker: string
  setup: string
  credit: string
  pop: string
  direction: string
  signal: string
}

interface OptionsStrategyToolboxProps {
  strategy: keyof typeof STRATEGIES
}

export function OptionsStrategyToolbox({ strategy = "credit-spreads" }: OptionsStrategyToolboxProps) {
  const config = STRATEGIES[strategy]

  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)
  const [walkthroughSetup, setWalkthroughSetup] = useState<WalkthroughSetup | null>(null)

  // The example cards render `config.setups` and only that — static teaching
  // examples, labelled as such where they appear.
  //
  // There used to be a `setups` state that overrode them from a POST to
  // /api/strategy-scanner, plus `isScanning` and `lastScanned`. That route did
  // not scan: it returned three invented setups (SPY 595/590 at $2.35 / 72% POP,
  // and two more) at HTTP 200, its own comment admitting "Since AI functionality
  // is not used, we return default setups". The override therefore swapped a
  // correctly-labelled teaching example for an invented one and stamped it
  // "Last scanned: <time>" — which is the part that did the damage, because a
  // timestamp turns an illustration into a result. Nine LEARN tabs share this
  // component. The route now returns 501 and this state is gone.

  if (!config) {
    return <div className="p-8 text-center text-gray-500">Strategy not found</div>
  }

  const getPayoffChartData = (payoffData: { x: number; y: number }[]) => {
    return payoffData.map((point) => ({
      x: point.x,
      profit: point.y > 0 ? point.y : 0,
      loss: point.y < 0 ? point.y : 0,
      y: point.y,
    }))
  }

  const InfoTooltip = ({ content }: { content: string }) => {
    if (!tooltipsEnabled) return null
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-gray-400 cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-white text-gray-900 border shadow-lg p-3 z-50">
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <TooltipProvider>
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
                  {/* Said "with real-time market examples". The examples are a
                      static array in this file — nothing about them is real-time. */}
                  <InfoTooltip
                    content={`${config.name}: ${config.tagline}. This page shows you how to set up and manage ${config.name.toLowerCase()} trades, using worked examples chosen to illustrate the structure.`}
                  />
                </div>
                <p className="text-lg text-teal-700">{config.tagline}</p>
              </div>
              {/* The Scan control and its "Last scanned: <time>" stamp are gone
                  with the route that fed them. There is no live setup scan on
                  this site, and a timestamp is what turned a labelled teaching
                  example into something that read as a result. */}
              <div className="flex items-center gap-2">
                <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Main Content: Payoff Diagram + Stats */}
          <div className="grid lg:grid-cols-5 gap-6 mb-8">
            {/* Payoff Diagram */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                  Payoff Diagram
                  <InfoTooltip content="This chart shows your profit (green) and loss (red) at different stock prices at expiration. The horizontal axis is the stock price, vertical axis is your profit/loss in dollars per contract." />
                </h3>
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
                <CardTitle className="text-lg font-semibold flex items-center" style={{ color: "#1E3A8A" }}>
                  Strategy Characteristics
                  <InfoTooltip content="These are the key numbers that define this strategy. Understanding these helps you know what to expect from the trade - your potential profit, risk, and ideal market conditions." />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 text-green-700 mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-xs font-medium">Max Profit</span>
                      <InfoTooltip content="The maximum amount you can make on this trade if everything goes perfectly. For credit strategies, this is the premium you collect upfront. For debit strategies, it's calculated based on strike width minus cost." />
                    </div>
                    <p className="text-sm font-semibold text-green-900">{config.stats.maxProfit}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 text-red-700 mb-1">
                      <Shield className="h-4 w-4" />
                      <span className="text-xs font-medium">Max Loss</span>
                      <InfoTooltip content="The worst-case scenario - the most you can lose on this trade. This is your defined risk. Knowing this BEFORE you enter helps you size positions properly and sleep at night." />
                    </div>
                    <p className="text-sm font-semibold text-red-900">{config.stats.maxLoss}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 text-blue-700 mb-1">
                      <Target className="h-4 w-4" />
                      <span className="text-xs font-medium">Probability of Profit</span>
                      <InfoTooltip content="The statistical likelihood you'll make money on this trade. Higher probability (70%+) usually means smaller profits per trade. Lower probability strategies can pay more but lose more often. Balance this with your risk tolerance." />
                    </div>
                    <p className="text-sm font-semibold text-blue-900">{config.stats.probability}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 text-purple-700 mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-xs font-medium">Best Market</span>
                      <InfoTooltip content="The market conditions where this strategy performs best. Some strategies need trending markets, others need range-bound (sideways) markets. Using the right strategy for current conditions dramatically improves your odds." />
                    </div>
                    <p className="text-sm font-semibold text-purple-900">{config.stats.bestMarket}</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-2 text-orange-700 mb-1">
                      <Activity className="h-4 w-4" />
                      <span className="text-xs font-medium">Ideal IV Rank</span>
                      <InfoTooltip content="IV Rank shows how expensive options are compared to the past year (0-100%). For SELLING options: higher IV (>50%) is better - you collect more premium. For BUYING options: lower IV (<30%) is better - options are cheaper." />
                    </div>
                    <p className="text-sm font-semibold text-orange-900">{config.stats.idealIV}</p>
                  </div>
                  <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                    <div className="flex items-center gap-2 text-teal-700 mb-1">
                      <Clock className="h-4 w-4" />
                      <span className="text-xs font-medium">Typical DTE</span>
                      <InfoTooltip content="Days to Expiration - how long until the options expire. Shorter DTE (7-21 days) = faster time decay, but less room for error. Longer DTE (30-60 days) = more flexibility, but ties up capital longer. Match DTE to your trading style." />
                    </div>
                    <p className="text-sm font-semibold text-teal-900">{config.stats.typicalDTE}</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-700 mb-1">
                    <Calculator className="h-4 w-4 mr-2" />
                    <span className="text-xs font-medium">Breakeven</span>
                    <InfoTooltip content="The stock price where you neither make nor lose money at expiration. For credit strategies, you want the stock to stay AWAY from this price. For debit strategies, you need the stock to move PAST this price to profit." />
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
                Example Setups (For Learning)
              </h2>
              {/* The "AI Scanning Markets..." badge went with the scan: no model
                  ran and no market was read. This tooltip was already the most
                  honest sentence on the page — it is why the defect was worth
                  fixing rather than relabelling. */}
              <InfoTooltip content="These are illustrative teaching examples — not live trade recommendations, and they do not update with the market. Each example shows a realistic ticker, the specific options to trade, premium, and probability of profit. Click Run Scenario for a step-by-step walkthrough of how to place the trade. Always do your own research before trading." />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {config.setups.map((setup, idx) => (
                <Card key={idx} className="shadow-md hover:shadow-lg transition-shadow">
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
                      <div className="flex items-center">
                        <span className="text-gray-500">Premium:</span>
                        <span className="ml-1 font-semibold text-green-600">{setup.credit}</span>
                        <InfoTooltip content="The money you collect (credit) or pay (debit) to enter this trade. Credit = you get paid upfront. Debit = you pay to open. This is your max profit for credit trades." />
                      </div>
                      <div className="flex items-center">
                        <span className="text-gray-500">POP:</span>
                        <span className="ml-1 font-semibold text-blue-600">{setup.pop}</span>
                        <InfoTooltip content="Probability of Profit - the statistical chance this trade makes any money at all. 70% POP means 7 out of 10 similar trades historically made money." />
                      </div>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => setWalkthroughSetup(setup)}
                          className="w-full text-white bg-[#0D9488] hover:bg-[#0F766E]"
                        >
                          Run Scenario
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Step-by-step walkthrough: how to place {setup.setup} on {setup.ticker} in thinkorswim.
                        </p>
                      </TooltipContent>
                    </Tooltip>
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
                How This Strategy Works & When to Adjust
              </h2>
              {/* Was "AI Trade Ideas & Adjustments This Week", with a tooltip
                  claiming "Our AI analyzes current market conditions ... why
                  these setups make sense now". Everything below renders
                  `config.insights`, a static object literal in this file — no
                  model runs, no market data is read, and the text is byte-for-byte
                  identical on every load and every week. Three false claims in one
                  heading (AI, current conditions, this week), and because this
                  component serves nine LEARN tabs it made all three on nine of
                  them. */}
              <InfoTooltip content="Written reference for this strategy: what it is, the entry criteria worth insisting on, and what to do when a position moves against you. This is fixed educational material — it does not read live market data and does not change week to week." />
            </div>
            <div className="space-y-3">
              <div className="border rounded-lg shadow-sm bg-white">
                <div className="px-4 py-3 hover:no-underline">
                  <span className="font-semibold flex items-center" style={{ color: "#1E3A8A" }}>
                    Market Outlook Impact
                    <InfoTooltip content="How current market conditions (volatility, trend, news) affect this strategy. Understanding market context helps you pick the right strategy and timing." />
                  </span>
                </div>
                <div className="px-4 pb-4">
                  <p className="text-gray-700 leading-relaxed">{config.insights.outlook}</p>
                </div>
              </div>
              <div className="border rounded-lg shadow-sm bg-white">
                <div className="px-4 py-3 hover:no-underline">
                  <span className="font-semibold flex items-center" style={{ color: "#1E3A8A" }}>
                    Entry Rules I'm Using
                    <InfoTooltip content="Specific criteria that must be met before entering a trade. Following strict entry rules prevents impulsive trades and improves long-term results. Only trade when ALL your rules are satisfied." />
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
                  <span className="font-semibold flex items-center" style={{ color: "#1E3A8A" }}>
                    Adjustment Triggers
                    <InfoTooltip content="When and how to modify a trade that's moving against you. Good traders don't just enter trades - they have a plan for what to do when things don't go as expected. These are your 'if this happens, do that' rules." />
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

      <TradeWalkthroughModal
        open={walkthroughSetup !== null}
        onClose={() => setWalkthroughSetup(null)}
        setup={walkthroughSetup}
        strategyKey={strategy}
        strategyName={config.name}
        typicalDTE={config.stats.typicalDTE}
      />
    </TooltipProvider>
  )
}
