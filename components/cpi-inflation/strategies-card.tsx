"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CPIData } from "./cpi-types"

export function StrategiesCard({ cpiData }: { cpiData: CPIData }) {
  return (
    <Card className="shadow-lg border-2 border-primary">
      <CardHeader className="bg-primary/5 border-b border-primary/20">
        <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Inflation-Based Options Strategies
        </CardTitle>
        <CardDescription className="text-base">
          A fixed list selected by the {cpiData.inflationPressure.toLowerCase()} pressure band (CPI:{" "}
          {cpiData.currentCPI.toFixed(1)}% vs Target: {cpiData.fedTarget.toFixed(1)}%). Nothing here reads a price or an
          option chain.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid md:grid-cols-2 gap-4">
          {cpiData.optionsStrategies.map((strategy, index) => (
            <Card key={index} className="border-2 border-gray-200 hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-gray-900">{strategy.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {strategy.ticker}
                      </span>
                      <span className="text-xs text-gray-600">{strategy.type}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-700">{strategy.rationale}</p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-900 min-w-[70px]">Entry:</span>
                    <span className="text-gray-700">{strategy.entry}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-900 min-w-[70px]">Target:</span>
                    <span className="text-gray-700">{strategy.target}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-900 min-w-[70px]">Stop Loss:</span>
                    <span className="text-gray-700">{strategy.stopLoss}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-900 min-w-[70px]">Timeframe:</span>
                    <span className="text-gray-700">{strategy.timeframe}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <div className="flex items-start gap-2 text-xs">
                    <svg
                      className="h-3 w-3 mt-0.5 flex-shrink-0 text-orange-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <p className="text-gray-600">
                      <span className="font-semibold">Risk:</span> {strategy.risk}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">⚠️ Important Disclaimer:</span> These strategies are for educational purposes
            only and do not constitute financial advice. Inflation data can be volatile and revised. Always conduct your
            own research and consider consulting with a licensed financial advisor before making any investment
            decisions.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
