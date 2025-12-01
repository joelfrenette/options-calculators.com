"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  DollarSign,
  Shield,
  Zap,
  ArrowRightLeft,
  XCircle,
  Info,
  Calculator,
  BarChart3,
  Sparkles,
} from "lucide-react"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"

// Exit rule types
interface ExitRule {
  id: string
  name: string
  trigger: string
  action: string
  priority: "high" | "medium" | "low"
  category: "profit" | "loss" | "time" | "technical"
}

const PROFIT_TAKING_RULES: ExitRule[] = [
  {
    id: "50-percent",
    name: "50% Profit Target",
    trigger: "Position reaches 50% of max profit",
    action: "Close entire position or scale out 50%",
    priority: "high",
    category: "profit",
  },
  {
    id: "21-dte",
    name: "21 DTE Rule",
    trigger: "21 days until expiration reached",
    action: "Close position regardless of P/L to avoid gamma risk",
    priority: "high",
    category: "time",
  },
  {
    id: "theta-decay",
    name: "Theta Decay Acceleration",
    trigger: "Position enters final 14 DTE with profit",
    action: "Consider closing to lock in gains before gamma increases",
    priority: "medium",
    category: "time",
  },
  {
    id: "iv-crush",
    name: "Post-Event IV Crush",
    trigger: "IV drops 20%+ after earnings/event",
    action: "Close short premium positions immediately",
    priority: "high",
    category: "technical",
  },
  {
    id: "technical-breakout",
    name: "Technical Breakout",
    trigger: "Underlying breaks key support/resistance",
    action: "Adjust or close directional positions",
    priority: "medium",
    category: "technical",
  },
]

const STOP_LOSS_RULES: ExitRule[] = [
  {
    id: "2x-credit",
    name: "2x Credit Stop",
    trigger: "Loss equals 2x credit received",
    action: "Close position immediately - no exceptions",
    priority: "high",
    category: "loss",
  },
  {
    id: "breakeven-breach",
    name: "Breakeven Breach",
    trigger: "Underlying moves past breakeven point",
    action: "Evaluate adjustment or close within 24 hours",
    priority: "high",
    category: "loss",
  },
  {
    id: "short-strike-test",
    name: "Short Strike Test",
    trigger: "Underlying within 1% of short strike",
    action: "Roll position or close for loss",
    priority: "high",
    category: "loss",
  },
  {
    id: "delta-threshold",
    name: "Delta Threshold",
    trigger: "Position delta exceeds comfort zone",
    action: "Hedge with opposing delta or reduce size",
    priority: "medium",
    category: "technical",
  },
  {
    id: "portfolio-heat",
    name: "Portfolio Heat Check",
    trigger: "Single position > 5% of portfolio",
    action: "Scale down to maintain risk limits",
    priority: "medium",
    category: "loss",
  },
]

const STRATEGY_EXIT_GUIDES = [
  {
    strategy: "Credit Spreads",
    profitTarget: "50-75% of max profit",
    stopLoss: "2x credit received",
    timeExit: "Close at 21 DTE or sooner",
    keyTriggers: ["Short strike tested", "IV expansion > 30%", "Underlying trend reversal"],
  },
  {
    strategy: "Iron Condors",
    profitTarget: "50% of max profit",
    stopLoss: "2x credit on tested side",
    timeExit: "Close at 21 DTE",
    keyTriggers: ["One wing tested", "VIX spike > 20%", "Major news event pending"],
  },
  {
    strategy: "Calendar Spreads",
    profitTarget: "25-50% of debit paid",
    stopLoss: "50% of debit paid",
    timeExit: "Close before front month expiration",
    keyTriggers: ["Underlying moves away from strike", "IV term structure inverts", "Front month theta accelerates"],
  },
  {
    strategy: "Butterflies",
    profitTarget: "50-100% of debit paid",
    stopLoss: "50-75% of debit paid",
    timeExit: "Close 3-5 DTE for long flies",
    keyTriggers: ["Underlying moves outside wings", "Time decay slows", "Vol crush after event"],
  },
  {
    strategy: "The Wheel",
    profitTarget: "Full premium collection",
    stopLoss: "Assignment at strike you're comfortable owning",
    timeExit: "Let expire worthless or get assigned",
    keyTriggers: ["Stock fundamentals change", "Better opportunity elsewhere", "Portfolio rebalance needed"],
  },
  {
    strategy: "Straddles/Strangles",
    profitTarget: "25-50% for short, 50-100% for long",
    stopLoss: "2x credit (short) or 50% debit (long)",
    timeExit: "Close short at 21 DTE, long before event",
    keyTriggers: ["Expected move realized", "IV crush complete", "Theta decay accelerating"],
  },
]

export function ExitRulesDashboard() {
  const [activeStrategy, setActiveStrategy] = useState("Credit Spreads")
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700 border-red-200"
      case "medium":
        return "bg-amber-100 text-amber-700 border-amber-200"
      case "low":
        return "bg-green-100 text-green-700 border-green-200"
      default:
        return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "profit":
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case "loss":
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case "time":
        return <Clock className="h-4 w-4 text-blue-600" />
      case "technical":
        return <BarChart3 className="h-4 w-4 text-purple-600" />
      default:
        return <Info className="h-4 w-4 text-gray-600" />
    }
  }

  const selectedGuide = STRATEGY_EXIT_GUIDES.find((g) => g.strategy === activeStrategy)

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 mb-2">
              <Target className="h-8 w-8 text-emerald-400" />
              <h1 className="text-2xl font-bold">Exit Rules & Profit-Taking Triggers</h1>
              <InfoTooltip content="This dashboard teaches you WHEN to close your options trades. Most traders lose money not because of bad entries, but because of poor exits. These rules help you lock in profits and cut losses before they become disasters." />
            </div>
            <div className="flex items-center gap-2">
              <TooltipsToggle enabled={tooltipsEnabled} onToggle={setTooltipsEnabled} />
              <RefreshButton />
            </div>
          </div>
          <p className="text-slate-300 max-w-2xl">
            Systematic exit rules remove emotion from trading decisions. Define your exits before entering any trade.
          </p>
        </div>

        {/* Key Metrics Cards with Tooltips */}
        <div className="flex flex-wrap gap-3 mt-4">
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                <TrendingUp className="h-5 w-5" />
                Profit Target
                <InfoTooltip content="The price point where you close a winning trade to lock in gains. Taking profits at 50% of max profit has been shown to increase long-term win rates because you avoid giving back gains when the trade reverses." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">50%</div>
              <p className="text-sm text-green-600/80">of max profit - standard target</p>
              <p className="text-xs text-muted-foreground mt-2">
                Close at 50% to maximize win rate and reduce risk of giving back gains
              </p>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                <TrendingDown className="h-5 w-5" />
                Stop Loss
                <InfoTooltip content="The maximum loss you'll accept before closing a losing trade. The 2x credit rule means if you collected $100 in premium, you close if the loss reaches $200. This limits damage and preserves capital for future trades." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">2x</div>
              <p className="text-sm text-red-600/80">credit received - max loss</p>
              <p className="text-xs text-muted-foreground mt-2">
                Never let a losing trade exceed 2x your original credit received
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
                <Clock className="h-5 w-5" />
                Time Exit
                <InfoTooltip content="Close positions at 21 Days to Expiration regardless of profit/loss. This is because 'gamma risk' increases dramatically in the final weeks - small price moves can cause huge P/L swings. It's better to exit early and redeploy capital." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">21</div>
              <p className="text-sm text-blue-600/80">DTE - close before gamma risk</p>
              <p className="text-xs text-muted-foreground mt-2">
                Close positions at 21 DTE to avoid gamma acceleration
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="profit-rules" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="profit-rules" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Profit Rules
            </TabsTrigger>
            <TabsTrigger value="stop-loss" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Stop Loss Rules
            </TabsTrigger>
            <TabsTrigger value="by-strategy" className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              By Strategy
            </TabsTrigger>
          </TabsList>

          {/* Profit Taking Rules Tab */}
          <TabsContent value="profit-rules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Profit-Taking Triggers
                  <InfoTooltip content="These rules tell you when to CLOSE winning trades. The key insight: a bird in the hand is worth two in the bush. Taking profits early increases your overall win rate even if you occasionally miss bigger gains." />
                </CardTitle>
                <CardDescription>When to take profits and lock in gains</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {PROFIT_TAKING_RULES.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">{getCategoryIcon(rule.category)}</div>
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{rule.name}</span>
                        <Badge variant="outline" className={getPriorityColor(rule.priority)}>
                          {rule.priority}
                        </Badge>
                        {rule.id === "50-percent" && (
                          <InfoTooltip content="When your trade has made 50% of its maximum possible profit, close it. Example: If max profit is $200, close when you've made $100. This locks in a win and frees capital for new trades." />
                        )}
                        {rule.id === "21-dte" && (
                          <InfoTooltip content="With 21 days left until expiration, gamma (the rate delta changes) increases dramatically. Small stock moves cause big P/L swings. Close early to avoid this 'gamma roller coaster'." />
                        )}
                        {rule.id === "theta-decay" && (
                          <InfoTooltip content="Time decay (theta) accelerates in the final 2 weeks. If you have a profit, lock it in before the increased gamma risk can take it away." />
                        )}
                        {rule.id === "iv-crush" && (
                          <InfoTooltip content="After earnings or major events, implied volatility drops sharply (IV crush). If you sold premium, this is when you profit most - close immediately to capture the gains before anything else happens." />
                        )}
                        {rule.id === "technical-breakout" && (
                          <InfoTooltip content="When a stock breaks through a major support or resistance level, it often continues in that direction. If this hurts your position, exit quickly before the move accelerates." />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        <span className="font-medium text-foreground">Trigger:</span> {rule.trigger}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-green-600">Action:</span> {rule.action}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stop Loss Rules Tab */}
          <TabsContent value="stop-loss" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Stop Loss & Risk Management
                  <InfoTooltip content="These rules tell you when to CLOSE losing trades. The hardest part of trading is admitting you're wrong and cutting losses. These mechanical rules remove emotion and protect your capital for future opportunities." />
                </CardTitle>
                <CardDescription>When to cut losses and protect capital</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {STOP_LOSS_RULES.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">{getCategoryIcon(rule.category)}</div>
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{rule.name}</span>
                        <Badge variant="outline" className={getPriorityColor(rule.priority)}>
                          {rule.priority}
                        </Badge>
                        {rule.id === "2x-credit" && (
                          <InfoTooltip content="If you collected $100 credit and are now losing $200, close immediately. This prevents a manageable loss from becoming a portfolio-destroying disaster. No exceptions - this is your absolute max pain point." />
                        )}
                        {rule.id === "breakeven-breach" && (
                          <InfoTooltip content="Your breakeven is the price where you neither make nor lose money. Once the stock moves past this point, you're in losing territory. Evaluate quickly whether to close or adjust." />
                        )}
                        {rule.id === "short-strike-test" && (
                          <InfoTooltip content="When the stock price gets within 1% of your short strike, the trade is in danger. This is your 'early warning system' - either roll the position to a safer strike or close and move on." />
                        )}
                        {rule.id === "delta-threshold" && (
                          <InfoTooltip content="Delta measures how much your position moves with the stock. If delta gets too high (positive or negative), you have too much directional risk. Hedge by adding an opposing position or reduce size." />
                        )}
                        {rule.id === "portfolio-heat" && (
                          <InfoTooltip content="No single position should be more than 5% of your total portfolio. If a trade grows too large (through paper gains or adding to it), trim it back to maintain proper diversification." />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        <span className="font-medium text-foreground">Trigger:</span> {rule.trigger}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-red-600">Action:</span> {rule.action}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* By Strategy Tab */}
          <TabsContent value="by-strategy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-purple-600" />
                  Exit Rules by Strategy
                  <InfoTooltip content="Different strategies have different optimal exit points. These guidelines are based on backtested research showing the profit/loss targets that maximize long-term returns for each strategy type." />
                </CardTitle>
                <CardDescription>Strategy-specific exit guidelines</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Strategy Selector */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {STRATEGY_EXIT_GUIDES.map((guide) => (
                    <Button
                      key={guide.strategy}
                      variant={activeStrategy === guide.strategy ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveStrategy(guide.strategy)}
                      className={activeStrategy === guide.strategy ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                    >
                      {guide.strategy}
                    </Button>
                  ))}
                </div>

                {/* Selected Strategy Guide */}
                {selectedGuide && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800">{selectedGuide.strategy}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="font-semibold text-green-700">Profit Target</span>
                          <InfoTooltip content="Close the trade when you've captured this percentage of your maximum possible profit. Taking profits early improves win rate and frees capital for new opportunities." />
                        </div>
                        <p className="text-lg font-bold text-green-600">{selectedGuide.profitTarget}</p>
                      </div>

                      <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="font-semibold text-red-700">Stop Loss</span>
                          <InfoTooltip content="Close the trade if your loss reaches this level. Cutting losses quickly preserves capital and mental energy for winning trades." />
                        </div>
                        <p className="text-lg font-bold text-red-600">{selectedGuide.stopLoss}</p>
                      </div>

                      <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold text-blue-700">Time Exit</span>
                          <InfoTooltip content="Close the trade by this time regardless of profit/loss. Time-based exits prevent gamma risk and avoid holding too long." />
                        </div>
                        <p className="text-lg font-bold text-blue-600">{selectedGuide.timeExit}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span className="font-semibold text-amber-700">Key Exit Triggers</span>
                        <InfoTooltip content="Watch for these warning signs that indicate you should exit or adjust the trade immediately, even if you haven't hit your profit target or stop loss yet." />
                      </div>
                      <ul className="space-y-2">
                        {selectedGuide.keyTriggers.map((trigger, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm">
                            <Zap className="h-3 w-3 text-amber-500" />
                            <span>{trigger}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* AI Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-600" />
              AI Insights: Exit Strategy Psychology
              <InfoTooltip content="Understanding the psychological aspects of exiting trades is just as important as the mechanical rules. These insights help you overcome common mental barriers to proper trade management." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion
              type="multiple"
              defaultValue={["psychology", "scaling", "automation", "options-specific"]}
              className="w-full"
            >
              <AccordionItem value="psychology">
                <AccordionTrigger className="text-left">Why Traders Fail to Exit Properly</AccordionTrigger>
                <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    The biggest challenge in options trading isn't finding entries—it's executing exits. Behavioral
                    biases like loss aversion, anchoring, and overconfidence cause traders to hold losers too long and
                    cut winners too early.
                  </p>
                  <div className="bg-slate-50 p-3 rounded-lg border">
                    <p className="font-medium text-slate-700 mb-2">Common Exit Mistakes:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Hoping a losing trade will recover (loss aversion)</li>
                      <li>Taking profits too early out of fear (risk aversion)</li>
                      <li>Moving stop losses to avoid being stopped out</li>
                      <li>Ignoring time decay until it's too late</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="scaling">
                <AccordionTrigger className="text-left">Scaling Out vs. All-or-Nothing Exits</AccordionTrigger>
                <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Consider scaling out of winning positions rather than closing entirely. This approach lets you lock
                    in profits while maintaining exposure to additional gains.
                  </p>
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                    <p className="font-medium text-emerald-700 mb-2">Scaling Strategy Example:</p>
                    <ul className="list-disc list-inside space-y-1 text-emerald-600">
                      <li>At 25% profit: Close 1/3 of position</li>
                      <li>At 50% profit: Close another 1/3</li>
                      <li>Let final 1/3 ride with trailing stop</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
