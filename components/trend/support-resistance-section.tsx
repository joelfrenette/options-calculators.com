"use client"

/**
 * Support and resistance levels.
 *
 * Split out of `components/trend-analysis.tsx` (P6-13) unchanged. What it closed
 * over is now props.
 */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, AlertTriangle, Info, Shield, Target, TrendingUp } from "lucide-react"
import type { TrendData } from "./trend-types"

export function SupportResistanceSection({
  selectedItem,
}: {
  selectedItem: TrendData
}) {
  return (
    <>
        <Accordion type="single" collapsible defaultValue="support-resistance">
          <AccordionItem value="support-resistance" className="border rounded-lg shadow-sm">
            <AccordionTrigger className="px-6 py-4 bg-gray-50 hover:bg-gray-100 rounded-t-lg border-b">
              <div className="text-left">
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedItem.name} - Key Support & Resistance Levels
                </h3>
                <p className="text-sm text-gray-600 mt-1">View historical and dynamic support/resistance zones</p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Primary Support</p>
                  <p className="text-xl font-bold text-gray-900">${selectedItem.support.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Crucial level for maintaining bullish sentiment. A break below may signal further downside.
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Primary Resistance</p>
                  <p className="text-xl font-bold text-gray-900">${selectedItem.resistance.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Key level where selling pressure may increase. A decisive break above could fuel a rally.
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <p className="text-sm font-semibold text-orange-700 mb-1">Potential Volatility Spike</p>
                  <p className="text-xl font-bold text-orange-700">${selectedItem.atr.toFixed(2)}</p>
                  <p className="text-xs text-orange-600 mt-1">
                    Average True Range (ATR) indicates typical daily price movement. Higher ATR suggests higher
                    volatility.
                  </p>
                </div>
              </div>
              {selectedItem.allSupport && selectedItem.allSupport.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="text-md font-bold text-gray-900 mb-3">All Support Levels</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.allSupport.map((level, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center rounded-md bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
                      >
                        ${level.toFixed(2)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedItem.allResistance && selectedItem.allResistance.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="text-md font-bold text-gray-900 mb-3">All Resistance Levels</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.allResistance.map((level, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center rounded-md bg-red-100 px-3 py-1 text-sm font-medium text-red-800"
                      >
                        ${level.toFixed(2)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

    </>
  )
}
