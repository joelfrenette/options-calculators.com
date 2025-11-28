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
import { Menu, X, TrendingUp, Zap, Search } from "lucide-react"
import Image from "next/image"

const ANALYZE_TABS = [
  { id: "earnings-calendar", label: "Earnings Calendar" },
  { id: "trend-analysis", label: "Index Trend" },
  { id: "risk-management", label: "VIX Index" },
  { id: "market-sentiment", label: "Fear & Greed" },
  { id: "panic-euphoria", label: "Panic Index" },
  { id: "social-sentiment", label: "Social Sentiment" },
  { id: "ccpi", label: "CCPI" },
  { id: "fomc-predictions", label: "Fed Rate" },
  { id: "jobs", label: "Jobs" },
  { id: "cpi-inflation", label: "CPI Inflation" },
  { id: "insiders", label: "Insiders" },
]

const SCAN_TABS = [
  { id: "wheel-scanner", label: "Put Scanner" },
  { id: "earnings-scanner", label: "Earnings Scanner" },
  { id: "iv-scanner", label: "IV Scanner" },
  { id: "unusual-activity", label: "Unusual Activity" },
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
      case "jobs":
        return <JobsReportDashboard />
      case "cpi-inflation":
        return <CpiInflationAnalysis />
      case "insiders":
        return <InsiderTradingDashboard />
      case "wheel-scanner":
        return <WheelScanner />
      case "earnings-scanner":
        return <EarningsVolatilityCalculator />
      case "iv-scanner":
        return <WheelScanner />
      case "unusual-activity":
        return <WheelScanner />
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
        return <OptionsStrategyToolbox strategy="wheel" />
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
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <nav className="hidden md:flex border-b border-gray-200 -mx-4 px-4">
              {currentTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors border-b-2 text-center leading-tight ${
                    activeTab === tab.id
                      ? "border-primary text-primary bg-green-50"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
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

                  {currentTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`w-full text-left px-4 py-3 text-base font-semibold transition-colors ${
                        activeTab === tab.id
                          ? "bg-green-50 text-primary border-l-4 border-primary"
                          : "text-gray-700 hover:bg-gray-50 border-l-4 border-transparent"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
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
  )
}
