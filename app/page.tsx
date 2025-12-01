"use client"

import { useState } from "react"
import { RiskCalculator } from "@/components/risk-calculator"
import { MarketSentiment } from "@/components/market-sentiment"
import { PanicEuphoria } from "@/components/panic-euphoria"
import { RiskRewardCalculator } from "@/components/risk-reward-calculator"
import { GreeksCalculator } from "@/components/greeks-calculator"
import { EarningsVolatilityCalculator } from "@/components/earnings-volatility-calculator"
import { FomcPredictions } from "@/components/fomc-predictions"
import { TrendAnalysis } from "@/components/trend-analysis"
import { RotatingAdBanner } from "@/components/rotating-ad-banner"
import { WheelScanner } from "@/components/wheel-scanner"
import { CpiInflationAnalysis } from "@/components/cpi-inflation-analysis"
import { CcpiDashboard } from "@/components/ccpi-dashboard"
import { SocialSentiment } from "@/components/social-sentiment"
import { EarningsEconomicCalendar } from "@/components/earnings-economic-calendar"
import { JobsReportDashboard } from "@/components/jobs-report-dashboard"
import { InsiderTradingDashboard } from "@/components/insider-trading-dashboard"
import { OptionsStrategyToolbox } from "@/components/options-strategy-toolbox"
import { ExitRulesDashboard } from "@/components/exit-rules-dashboard"
import { CreditSpreadScanner } from "@/components/credit-spread-scanner"
import { IronCondorScanner } from "@/components/iron-condor-scanner"
import { CalendarSpreadScanner } from "@/components/calendar-spread-scanner"
import { ButterflyScanner } from "@/components/butterfly-scanner"
import { LEAPSScanner } from "@/components/leaps-scanner"
import { ZEBRAScanner } from "@/components/zebra-scanner"
import { Menu, X, TrendingUp, Zap, Search } from "lucide-react"
import Image from "next/image"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const TAB_TOOLTIPS: Record<string, string> = {
  // SCAN tabs
  insiders:
    "Track when company executives and politicians buy or sell stock. When insiders buy their own company's stock, it often signals they believe the price will go up. Use this to find stocks that might be worth trading.",
  "wheel-scanner":
    "Find stocks perfect for selling cash-secured puts. You collect premium (income) upfront, and if assigned, you buy the stock at a discount. Best for stocks you'd happily own at lower prices.",
  "calendar-spread-scanner":
    "Discover opportunities where you can profit from time decay. Calendar spreads involve buying a longer-dated option and selling a shorter-dated one at the same strike. Profits when the stock stays near your strike price.",
  "credit-spread-scanner":
    "Find high-probability trades where you collect premium upfront with limited risk. Credit spreads profit when the stock stays above (put spreads) or below (call spreads) your strike price by expiration.",
  "iron-condor-scanner":
    "Locate range-bound stocks perfect for iron condors. You profit when the stock stays between two price levels. Ideal for sideways markets - you collect premium and keep it if the stock doesn't move too much.",
  "butterfly-scanner":
    "Find setups where you expect the stock to land near a specific price at expiration. Butterflies offer high reward-to-risk when you correctly predict where the stock will be. Low cost, potentially high return.",
  "leaps-scanner":
    "Long-term options (1+ year expiration) that let you control stock for a fraction of the cost. LEAPS give you time for your thesis to play out while risking less capital than buying shares outright.",
  "zebra-scanner":
    "Zero Extrinsic Back Ratio - a strategy that mimics stock ownership with less capital and defined risk. Great for directional plays where you want stock-like exposure without paying for time value.",

  // EXECUTE tabs - Strategy education
  "credit-spreads":
    "Sell a higher-premium option and buy a cheaper one for protection. You pocket the difference as profit if the stock moves your way (or stays still). Max profit is the credit received; max loss is defined by the spread width.",
  "iron-condors":
    "Combine a bull put spread and bear call spread on the same stock. You profit when the stock stays in a range between your short strikes. Great for high IV environments where you want to sell premium on both sides.",
  "calendar-spreads":
    "Buy a longer-dated option, sell a shorter-dated one at the same strike. Profits from time decay - the short option loses value faster than your long option. Works best when you expect the stock to stay near the strike.",
  butterflies:
    "A 3-leg strategy that profits most when the stock lands exactly at the middle strike at expiration. Very low cost to enter with potentially high returns. Risk is limited to what you pay for the spread.",
  collars:
    "Protect your stock gains without selling. Buy a put (insurance against drops) and sell a call (to pay for the put). You cap your upside but protect your downside. Great for locking in profits.",
  diagonals:
    "Like calendar spreads, but with different strikes. Buy a longer-dated option and sell shorter-dated options against it over time. Generates income while maintaining a directional position.",
  "straddles-strangles":
    "Buy both a call AND a put to profit from big moves in either direction. Use when you expect high volatility but don't know which way. You lose if the stock stays still (time decay hurts both legs).",
  "wheel-strategy":
    "The ultimate income strategy: sell puts until assigned, then sell calls on your shares until called away. Repeat. Works best on stocks you'd happily own long-term at lower prices.",

  // EXECUTE tabs - Tools
  "exit-rules":
    "Pre-defined rules for when to close your trades. Take profits at 50%? Cut losses at 2x? Having exit rules removes emotion and helps you trade consistently. Essential for disciplined trading.",
  "earnings-iv-crusher":
    "Calculate the expected stock move around earnings using option prices. Implied Volatility (IV) spikes before earnings, then crashes after (IV crush). Learn whether options are pricing in too much or too little movement.",
  greeks:
    "Delta, Gamma, Theta, Vega - the numbers that tell you how your option will behave. Delta = directional exposure, Theta = time decay, Vega = volatility sensitivity. Understanding Greeks helps you pick better strikes and manage risk.",
  "risk-rewards":
    "Calculate your potential profit vs. potential loss before entering a trade. A good trade typically has 2:1 or better reward-to-risk. This tool helps you evaluate whether a setup is worth taking.",
}

const ANALYZE_TABS = [
  {
    id: "earnings-calendar",
    label: "Earnings & Economic Calendar",
    tooltip:
      "See upcoming earnings reports and economic events that move markets. Earnings announcements often cause big stock moves - plan your trades around these dates.",
  },
  {
    id: "trend-analysis",
    label: "Index Trend Analysis",
    tooltip:
      "Analyze market direction for SPY, QQQ, IWM, and DIA. Knowing if the overall market is trending up, down, or sideways helps you choose the right options strategy.",
  },
  {
    id: "risk-management",
    label: "CBOE VIX Volatility Index",
    tooltip:
      "The 'fear gauge' of the market. High VIX (25+) means expensive options - great for selling premium. Low VIX (under 15) means cheap options - better for buying strategies.",
  },
  {
    id: "market-sentiment",
    label: "CNN's Fear & Greed",
    tooltip:
      "Measures if traders are fearful or greedy. Extreme fear often signals buying opportunities (sell puts). Extreme greed suggests caution (buy protective puts). Contrarian indicator.",
  },
  {
    id: "panic-euphoria",
    label: "Citibank's Panic & Euphoria Index",
    tooltip:
      "Professional-grade sentiment indicator. Readings below -0.17 (panic) have historically predicted market rallies. Readings above +0.41 (euphoria) often precede corrections.",
  },
  {
    id: "social-sentiment",
    label: "Social Sentiment Index",
    tooltip:
      "What retail traders are saying on Reddit, Twitter, and forums. Extreme bullish sentiment often signals tops; extreme bearish sentiment may signal bottoms.",
  },
  {
    id: "ccpi",
    label: "Crash & Corrections Prediction Index",
    tooltip:
      "AI-powered crash probability model. Combines multiple risk factors to estimate the chance of a major market decline. Helps you decide when to hedge or reduce risk.",
  },
  {
    id: "fomc-predictions",
    label: "FOMC Fed Rate Forecaster",
    tooltip:
      "Predict Fed interest rate decisions. Rate cuts are bullish for stocks; rate hikes are bearish. Options traders use Fed meetings as volatility events for straddles and strangles.",
  },
  {
    id: "cpi-inflation",
    label: "BLS CPI Inflation Forecaster",
    tooltip:
      "Forecast inflation data that moves markets. High inflation keeps rates high (bearish for growth stocks). Falling inflation suggests rate cuts coming (bullish).",
  },
  {
    id: "jobs",
    label: "BLS Jobs Rate Forecaster",
    tooltip:
      "Employment data affects Fed policy. Strong jobs = less likely to cut rates. Weak jobs = more likely to cut. Jobs Friday is a major volatility event each month.",
  },
]

const SCAN_TABS = [
  { id: "insiders", label: "Insider Trading Scanner" },
  { id: "wheel-scanner", label: "Sell Put Scanner" },
  { id: "calendar-spread-scanner", label: "Calendar Spreads" },
  { id: "credit-spread-scanner", label: "Credit Spreads" },
  { id: "iron-condor-scanner", label: "Iron Condors" },
  { id: "butterfly-scanner", label: "Butterflies" },
  { id: "leaps-scanner", label: "LEAPS" },
  { id: "zebra-scanner", label: "ZEBRA" },
]

const EXECUTE_TABS = [
  { id: "credit-spreads", label: "Credit Spreads" },
  { id: "iron-condors", label: "Iron Condors" },
  { id: "calendar-spreads", label: "Calendars" },
  { id: "butterflies", label: "Butterflies" },
  { id: "collars", label: "Collars" },
  { id: "diagonals", label: "Diagonals" },
  { id: "straddles-strangles", label: "Straddles" },
  { id: "wheel-strategy", label: "Wheel" },
  { id: "exit-rules", label: "Exit Rules" },
  { id: "earnings-iv-crusher", label: "Earnings EM" },
  { id: "greeks", label: "Greeks Calc" },
  { id: "risk-rewards", label: "ROI Calc" },
]

const CATEGORY_TOOLTIPS = {
  analyze:
    "Research tools: Check market conditions, sentiment, and upcoming events before you trade. Know the environment before placing any trades.",
  scan: "Find opportunities: Screen for the best setups across different strategies. These scanners find high-probability trades that match specific criteria.",
  execute:
    "Learn & calculate: Understand each strategy's mechanics, see payoff diagrams, and calculate risk/reward before you enter a trade.",
}

type Category = "analyze" | "scan" | "execute"

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<Category>("analyze")
  const [activeTab, setActiveTab] = useState("earnings-calendar")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const currentTabs = activeCategory === "analyze" ? ANALYZE_TABS : activeCategory === "scan" ? SCAN_TABS : EXECUTE_TABS

  const handleCategoryChange = (category: Category) => {
    setActiveCategory(category)
    const firstTab = category === "analyze" ? ANALYZE_TABS[0] : category === "scan" ? SCAN_TABS[0] : EXECUTE_TABS[0]
    setActiveTab(firstTab.id)
  }

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    setMobileMenuOpen(false)
  }

  const getTabTooltip = (tabId: string, tabLabel?: string): string | undefined => {
    // First check TAB_TOOLTIPS
    if (TAB_TOOLTIPS[tabId]) return TAB_TOOLTIPS[tabId]
    // Then check if tab has inline tooltip (ANALYZE_TABS)
    const analyzeTab = ANALYZE_TABS.find((t) => t.id === tabId)
    if (analyzeTab && "tooltip" in analyzeTab) return (analyzeTab as any).tooltip
    return undefined
  }

  const renderContent = () => {
    switch (activeTab) {
      case "earnings-calendar":
        return <EarningsEconomicCalendar />
      case "trend-analysis":
        return <TrendAnalysis />
      case "risk-management":
        return <RiskCalculator />
      case "market-sentiment":
        return <MarketSentiment />
      case "panic-euphoria":
        return <PanicEuphoria />
      case "social-sentiment":
        return <SocialSentiment />
      case "ccpi":
        return <CcpiDashboard />
      case "fomc-predictions":
        return <FomcPredictions />
      case "cpi-inflation":
        return <CpiInflationAnalysis />
      case "jobs":
        return <JobsReportDashboard />
      case "insiders":
        return <InsiderTradingDashboard />
      // SCAN tabs
      case "wheel-scanner":
        return <WheelScanner />
      case "calendar-spread-scanner":
        return <CalendarSpreadScanner />
      case "credit-spread-scanner":
        return <CreditSpreadScanner />
      case "iron-condor-scanner":
        return <IronCondorScanner />
      case "butterfly-scanner":
        return <ButterflyScanner />
      case "leaps-scanner":
        return <LEAPSScanner />
      case "zebra-scanner":
        return <ZEBRAScanner />
      // EXECUTE tabs
      case "credit-spreads":
        return <OptionsStrategyToolbox strategy="credit-spreads" />
      case "iron-condors":
        return <OptionsStrategyToolbox strategy="iron-condors" />
      case "calendar-spreads":
        return <OptionsStrategyToolbox strategy="calendar-spreads" />
      case "butterflies":
        return <OptionsStrategyToolbox strategy="butterflies" />
      case "collars":
        return <OptionsStrategyToolbox strategy="collars" />
      case "diagonals":
        return <OptionsStrategyToolbox strategy="diagonals" />
      case "straddles-strangles":
        return <OptionsStrategyToolbox strategy="straddles-strangles" />
      case "wheel-strategy":
        return <OptionsStrategyToolbox strategy="wheel-strategy" />
      case "exit-rules":
        return <ExitRulesDashboard />
      case "earnings-iv-crusher":
        return <EarningsVolatilityCalculator />
      case "greeks":
        return <GreeksCalculator />
      case "risk-rewards":
        return <RiskRewardCalculator />
      default:
        return <EarningsEconomicCalendar />
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="pt-0">
        <header className="border-b border-gray-200 bg-white shadow-sm">
          <div className="container mx-auto px-4">
            <div className="max-w-[1400px] mx-auto">
              <div className="flex items-center justify-between py-3 gap-4">
                <div className="flex items-center gap-2">
                  <Image
                    src="/images/design-mode/calculator-trim.png"
                    alt="Calculator Logo"
                    width={32}
                    height={32}
                    className="h-8 w-8"
                  />
                  <a
                    href="https://OPTIONS-CALCULATORS.COM"
                    className="text-xl md:text-2xl font-bold text-gray-900 hover:text-primary transition-colors"
                  >
                    OPTIONS-CALCULATORS.COM
                  </a>
                </div>

                <RotatingAdBanner />

                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 bg-gray-50 border-b border-gray-200">
            <div className="max-w-5xl mx-auto">
              <div className="hidden md:grid grid-cols-3 gap-0 py-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleCategoryChange("analyze")}
                      className={`flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold transition-all border-b-2 ${
                        activeCategory === "analyze"
                          ? "bg-emerald-700 text-white border-emerald-700"
                          : "bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-gray-200"
                      }`}
                    >
                      <TrendingUp className="h-4 w-4" />
                      ANALYZE
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-center">
                    <p>{CATEGORY_TOOLTIPS.analyze}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleCategoryChange("scan")}
                      className={`flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold transition-all border-b-2 border-x border-gray-200 ${
                        activeCategory === "scan"
                          ? "bg-emerald-700 text-white border-emerald-700"
                          : "bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <Search className="h-4 w-4" />
                      SCAN
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-center">
                    <p>{CATEGORY_TOOLTIPS.scan}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleCategoryChange("execute")}
                      className={`flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold transition-all border-b-2 ${
                        activeCategory === "execute"
                          ? "bg-emerald-700 text-white border-emerald-700"
                          : "bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-gray-200"
                      }`}
                    >
                      <Zap className="h-4 w-4" />
                      EXECUTE
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-center">
                    <p>{CATEGORY_TOOLTIPS.execute}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <nav className="hidden md:flex border-b border-gray-200 -mx-4 px-4">
                {currentTabs.map((tab) => {
                  const tooltip = getTabTooltip(tab.id)
                  return (
                    <Tooltip key={tab.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors border-b-2 text-center leading-tight ${
                            activeTab === tab.id
                              ? "border-primary text-primary bg-green-50"
                              : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                          }`}
                        >
                          {tab.label}
                        </button>
                      </TooltipTrigger>
                      {tooltip && (
                        <TooltipContent side="bottom" className="max-w-sm">
                          <p className="text-sm">{tooltip}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )
                })}
              </nav>

              {mobileMenuOpen && (
                <div className="md:hidden absolute left-0 right-0 top-[72px] bg-white border-b border-gray-200 shadow-lg z-50 max-h-[80vh] overflow-y-auto">
                  <nav className="py-2">
                    <div className="px-4 py-2 flex gap-2 border-b border-gray-100 mb-2">
                      <button
                        onClick={() => setActiveCategory("analyze")}
                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs font-bold rounded-lg transition-all ${
                          activeCategory === "analyze" ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <TrendingUp className="h-3 w-3" />
                        ANALYZE
                      </button>
                      <button
                        onClick={() => setActiveCategory("scan")}
                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs font-bold rounded-lg transition-all ${
                          activeCategory === "scan" ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <Search className="h-3 w-3" />
                        SCAN
                      </button>
                      <button
                        onClick={() => setActiveCategory("execute")}
                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs font-bold rounded-lg transition-all ${
                          activeCategory === "execute" ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <Zap className="h-3 w-3" />
                        EXECUTE
                      </button>
                    </div>

                    {currentTabs.map((tab) => {
                      const tooltip = getTabTooltip(tab.id)
                      return (
                        <button
                          key={tab.id}
                          onClick={() => handleTabChange(tab.id)}
                          className={`w-full text-left px-4 py-3 transition-colors ${
                            activeTab === tab.id
                              ? "bg-green-50 text-primary border-l-4 border-primary"
                              : "text-gray-700 hover:bg-gray-50 border-l-4 border-transparent"
                          }`}
                        >
                          <div className="font-semibold text-base">{tab.label}</div>
                          {tooltip && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tooltip}</div>}
                        </button>
                      )
                    })}
                  </nav>
                </div>
              )}

              <div className="md:hidden mt-2 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    <button
                      onClick={() => handleCategoryChange("analyze")}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold rounded transition-all ${
                        activeCategory === "analyze" ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      <TrendingUp className="h-3 w-3" />
                      ANALYZE
                    </button>
                    <button
                      onClick={() => handleCategoryChange("scan")}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold rounded transition-all ${
                        activeCategory === "scan" ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      <Search className="h-3 w-3" />
                      SCAN
                    </button>
                    <button
                      onClick={() => handleCategoryChange("execute")}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold rounded transition-all ${
                        activeCategory === "execute" ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      <Zap className="h-3 w-3" />
                      EXECUTE
                    </button>
                  </div>
                </div>
                <select
                  value={activeTab}
                  onChange={(e) => handleTabChange(e.target.value)}
                  className="w-full mt-2 p-2 border border-gray-300 rounded-lg text-sm font-medium bg-white"
                >
                  {currentTabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-screen bg-gray-50/50">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto py-6">{renderContent()}</div>
          </div>
        </main>

        <footer className="bg-white border-t border-gray-200 py-4 mt-8">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm text-gray-500 mb-2">
              &copy; 2025 OPTIONS-CALCULATORS.COM - Professional Tools for Options Traders
            </p>
            <p className="text-xs text-gray-400 max-w-4xl mx-auto">
              This website and its free AI-powered tools (including calculators, predictions, and analyses) are for
              educational and entertainment purposes only and do not constitute financial, investment, legal, or
              professional advice of any kind. We are not financial advisors, brokers, or certified professionals; all
              content is based on algorithms, formulas, and third-party data that may contain errors, inaccuracies, or
              biases—use at your own risk, with no guarantees of performance, profitability, or suitability. Always
              consult qualified experts and conduct your own due diligence before making decisions; we disclaim all
              liability for any losses or damages arising from reliance on this site. Additionally, we may earn
              commissions or other compensation from affiliate links or referrals to recommended software, services, or
              products on this site, at no extra cost to you.
            </p>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  )
}
