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
import { Menu, X } from "lucide-react"
import Image from "next/image"

const TABS = [
  { id: "trend-analysis", label: "Index Trend Analysis & Forecast" },
  { id: "market-sentiment", label: "Fear & Greed Index" },
  { id: "panic-euphoria", label: "Panic/Euphoria Index" },
  { id: "risk-management", label: "VIX Volatility Index" },
  { id: "fomc-predictions", label: "Fed Rate Analysis & Forecast" },
  { id: "cpi-inflation", label: "CPI Inflation Analysis & Forecast" },
  { id: "earnings-iv-crusher", label: "Earnings EM Calculator" },
  { id: "greeks", label: "Greeks Calculator" },
  { id: "risk-rewards", label: "ROI Calculator" },
  { id: "wheel-scanner", label: "Put Selling Scanner" }, // Updated tab name from "Stock Options Put Selling Scanner"
]

export default function Home() {
  const [activeTab, setActiveTab] = useState("trend-analysis")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    setMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-white">
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
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">OPTIONS-CALCULATORS.COM</h1>
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

        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <nav className="hidden md:flex border-b border-gray-200 -mx-4 px-4">
              {TABS.map((tab) => (
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
              <div className="md:hidden absolute left-0 right-0 top-[72px] bg-white border-b border-gray-200 shadow-lg z-50">
                <nav className="py-2">
                  {TABS.map((tab) => (
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
              <p className="text-sm font-semibold text-primary">{TABS.find((tab) => tab.id === activeTab)?.label}</p>
            </div>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black bg-opacity-20 z-40" onClick={() => setMobileMenuOpen(false)} />
      )}

      <main className="container mx-auto px-4 py-4">
        <div className="max-w-5xl mx-auto">
          {activeTab === "trend-analysis" && (
            <div>
              <div className="mb-4">
                <p className="text-lg text-gray-600 text-balance">
                  Assess market and sector trends with technical indicators to make informed trading decisions
                </p>
              </div>
              <TrendAnalysis />
            </div>
          )}

          {activeTab === "market-sentiment" && (
            <div>
              <div className="mb-4">
                <p className="text-lg text-gray-600 text-balance">
                  Comprehensive Fear & Greed Index combining 7 market indicators to guide your options trading strategy
                </p>
              </div>
              <MarketSentiment />
            </div>
          )}

          {activeTab === "panic-euphoria" && (
            <div>
              <div className="mb-4">
                <p className="text-lg text-gray-600 text-balance">
                  Citibank's Panic/Euphoria Model identifies extreme market sentiment using 9 indicators to spot
                  contrarian buying opportunities
                </p>
              </div>
              <PanicEuphoria />
            </div>
          )}

          {activeTab === "risk-management" && (
            <div>
              <div className="mb-4">
                <p className="text-lg text-gray-600 text-balance">
                  Calculate your recommended cash allocation based on current VIX volatility levels
                </p>
              </div>
              <RiskCalculator />
            </div>
          )}

          {activeTab === "fomc-predictions" && (
            <div>
              <div className="mb-4">
                <p className="text-lg text-gray-600 text-balance">
                  Anticipate FOMC outcomes using Fed Funds futures data and get options trading strategy suggestions
                </p>
              </div>
              <FomcPredictions />
            </div>
          )}

          {activeTab === "cpi-inflation" && (
            <div>
              <div className="mb-4">
                <p className="text-lg text-gray-600 text-balance">
                  Track inflation trends and forecast future CPI levels with options strategies for inflation trading
                </p>
              </div>
              <CpiInflationAnalysis />
            </div>
          )}

          {activeTab === "earnings-iv-crusher" && (
            <div>
              <div className="mb-4">
                <p className="text-lg text-gray-600 text-balance">
                  Analyze earnings volatility risk and calculate expected moves to avoid IV crush disasters
                </p>
              </div>
              <EarningsVolatilityCalculator />
            </div>
          )}

          {activeTab === "greeks" && (
            <div>
              <div className="mb-4">
                <p className="text-lg text-gray-600 text-balance">
                  Calculate option Greeks and get strategy-specific recommendations for optimal trade selection
                </p>
              </div>
              <GreeksCalculator />
            </div>
          )}

          {activeTab === "risk-rewards" && (
            <div>
              <div className="mb-4">
                <p className="text-lg text-gray-600 text-balance">
                  Calculate annualized ROI and compare against market benchmarks to evaluate trade quality
                </p>
              </div>
              <RiskRewardCalculator />
            </div>
          )}

          {activeTab === "wheel-scanner" && (
            <div>
              <div className="mb-4">
                <p className="text-lg text-gray-600 text-balance">
                  Scan stocks for optimal put-selling opportunities with using fundamental and technical analysis
                </p>
              </div>
              <WheelScanner />
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-200 mt-8 py-4 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <p className="text-center text-sm text-gray-600 mb-3">
              © 2025 OPTIONS-CALCULATORS.COM - Professional Tools for Options Traders
            </p>
            <p className="text-center text-xs text-gray-500 leading-relaxed max-w-4xl mx-auto">
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
        </div>
      </footer>
    </div>
  )
}
