"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, TrendingUp, DollarSign, Target, AlertCircle, Trash2, Plus } from "lucide-react"

interface WheelPosition {
  id: string
  ticker: string
  capital: number
  strikePrice: number
  premium: number
  status: "csp-active" | "assigned" | "cc-active" | "closed"
  entryDate: string
  shares?: number
  costBasis?: number
  totalPremium: number
}

export function WheelStrategyPlanner() {
  const [capital, setCapital] = useState<string>("10000")
  const [ticker, setTicker] = useState<string>("")
  const [stockPrice, setStockPrice] = useState<string>("")
  const [strikeMin, setStrikeMin] = useState<string>("")
  const [strikeMax, setStrikeMax] = useState<string>("")
  const [targetWeeklyIncome, setTargetWeeklyIncome] = useState<string>("")
  const [activeWheels, setActiveWheels] = useState<WheelPosition[]>([])

  // Load saved wheels from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("wheel-positions")
    if (saved) {
      setActiveWheels(JSON.parse(saved))
    }
  }, [])

  // Save wheels to localStorage
  useEffect(() => {
    if (activeWheels.length > 0) {
      localStorage.setItem("wheel-positions", JSON.stringify(activeWheels))
    }
  }, [activeWheels])

  const capitalNum = Number.parseFloat(capital) || 0
  const stockPriceNum = Number.parseFloat(stockPrice) || 0
  const strikeMinNum = Number.parseFloat(strikeMin) || 0
  const strikeMaxNum = Number.parseFloat(strikeMax) || 0
  const targetIncomeNum = Number.parseFloat(targetWeeklyIncome) || 0

  // Calculate suggested CSP parameters
  const maxContracts = Math.floor(capitalNum / (stockPriceNum * 100))
  const requiredPremiumPerContract = targetIncomeNum / maxContracts
  const requiredPremiumPercent = (requiredPremiumPerContract / stockPriceNum) * 100

  // Suggested strikes (typically 5-10% OTM for CSPs)
  const suggestedStrikes = []
  if (stockPriceNum > 0) {
    for (let i = 0.95; i >= 0.85; i -= 0.025) {
      const strike = Math.round(stockPriceNum * i)
      if (strike >= strikeMinNum && strike <= strikeMaxNum) {
        suggestedStrikes.push(strike)
      }
    }
  }

  // Assignment zone (within 5% of strike)
  const assignmentZone =
    suggestedStrikes.length > 0
      ? {
          lower: Math.round(suggestedStrikes[0] * 0.95),
          upper: Math.round(suggestedStrikes[0] * 1.05),
        }
      : null

  // Covered call targets (typically 5-10% OTM from assignment price)
  const coveredCallTargets = []
  if (suggestedStrikes.length > 0) {
    const assignmentPrice = suggestedStrikes[0]
    for (let i = 1.05; i <= 1.15; i += 0.025) {
      coveredCallTargets.push(Math.round(assignmentPrice * i))
    }
  }

  const addWheelPosition = () => {
    if (!ticker || !stockPrice || suggestedStrikes.length === 0) return

    const newPosition: WheelPosition = {
      id: Date.now().toString(),
      ticker: ticker.toUpperCase(),
      capital: capitalNum,
      strikePrice: suggestedStrikes[0],
      premium: requiredPremiumPerContract,
      status: "csp-active",
      entryDate: new Date().toISOString(),
      totalPremium: requiredPremiumPerContract * maxContracts,
    }

    setActiveWheels([...activeWheels, newPosition])
  }

  const updatePositionStatus = (id: string, newStatus: WheelPosition["status"]) => {
    setActiveWheels(activeWheels.map((pos) => (pos.id === id ? { ...pos, status: newStatus } : pos)))
  }

  const deletePosition = (id: string) => {
    setActiveWheels(activeWheels.filter((pos) => pos.id !== id))
  }

  const getStatusBadge = (status: WheelPosition["status"]) => {
    const statusConfig = {
      "csp-active": { label: "CSP Active", color: "bg-blue-100 text-blue-800" },
      assigned: { label: "Assigned", color: "bg-orange-100 text-orange-800" },
      "cc-active": { label: "CC Active", color: "bg-purple-100 text-purple-800" },
      closed: { label: "Closed", color: "bg-green-100 text-green-800" },
    }
    const config = statusConfig[status]
    return <Badge className={config.color}>{config.label}</Badge>
  }

  return (
    <div className="space-y-4">
      {/* Wheel Planner Input */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Wheel Strategy Planner
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="capital" className="text-sm font-semibold text-gray-700">
                  Available Capital
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="capital"
                    type="number"
                    value={capital}
                    onChange={(e) => setCapital(e.target.value)}
                    className="pl-9"
                    placeholder="10000"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ticker" className="text-sm font-semibold text-gray-700">
                  Stock Ticker
                </Label>
                <Input
                  id="ticker"
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                  className="uppercase"
                />
              </div>

              <div>
                <Label htmlFor="stockPrice" className="text-sm font-semibold text-gray-700">
                  Current Stock Price
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="stockPrice"
                    type="number"
                    value={stockPrice}
                    onChange={(e) => setStockPrice(e.target.value)}
                    className="pl-9"
                    placeholder="150.00"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="strikeMin" className="text-sm font-semibold text-gray-700">
                    Min Strike
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="strikeMin"
                      type="number"
                      value={strikeMin}
                      onChange={(e) => setStrikeMin(e.target.value)}
                      className="pl-9"
                      placeholder="130"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="strikeMax" className="text-sm font-semibold text-gray-700">
                    Max Strike
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="strikeMax"
                      type="number"
                      value={strikeMax}
                      onChange={(e) => setStrikeMax(e.target.value)}
                      className="pl-9"
                      placeholder="145"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="targetIncome" className="text-sm font-semibold text-gray-700">
                  Target Weekly Income
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="targetIncome"
                    type="number"
                    value={targetWeeklyIncome}
                    onChange={(e) => setTargetWeeklyIncome(e.target.value)}
                    className="pl-9"
                    placeholder="200"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={addWheelPosition}
                  disabled={!ticker || !stockPrice || suggestedStrikes.length === 0}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Active Wheels
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggested CSPs */}
      {stockPriceNum > 0 && suggestedStrikes.length > 0 && (
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Suggested Cash-Secured Puts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="grid md:grid-cols-3 gap-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Max Contracts</p>
                  <p className="text-xl font-bold text-gray-900">{maxContracts}</p>
                  <p className="text-xs text-gray-500">Based on ${capitalNum.toLocaleString()} capital</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Required Premium/Contract</p>
                  <p className="text-xl font-bold text-gray-900">${requiredPremiumPerContract.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{requiredPremiumPercent.toFixed(2)}% of stock price</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Total Weekly Income</p>
                  <p className="text-xl font-bold text-primary">${targetIncomeNum.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">
                    {((targetIncomeNum / capitalNum) * 100).toFixed(2)}% weekly return
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Recommended Strike Prices</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {suggestedStrikes.slice(0, 8).map((strike, idx) => (
                    <div key={idx} className="p-2 bg-gray-50 rounded border border-gray-200 text-center">
                      <p className="text-lg font-bold text-gray-900">${strike}</p>
                      <p className="text-xs text-gray-500">
                        {(((stockPriceNum - strike) / stockPriceNum) * 100).toFixed(1)}% OTM
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignment Zone & Covered Call Targets */}
      {assignmentZone && coveredCallTargets.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-orange-50 border-b border-orange-200">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Target Assignment Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-sm text-gray-600 mb-2">Assignment likely if stock drops to:</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${assignmentZone.lower} - ${assignmentZone.upper}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Within 5% of ${suggestedStrikes[0]} strike</p>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• Be prepared to own {maxContracts * 100} shares</p>
                  <p>• Cost basis: ${suggestedStrikes[0]} - premium received</p>
                  <p>• Capital required: ${(suggestedStrikes[0] * maxContracts * 100).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-purple-50 border-b border-purple-200">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Covered Call Targets
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <p className="text-sm text-gray-600">If assigned, sell covered calls at these strikes:</p>
                <div className="grid grid-cols-2 gap-2">
                  {coveredCallTargets.slice(0, 6).map((strike, idx) => (
                    <div key={idx} className="p-2 bg-purple-50 rounded border border-purple-200 text-center">
                      <p className="text-lg font-bold text-gray-900">${strike}</p>
                      <p className="text-xs text-gray-500">
                        {(((strike - suggestedStrikes[0]) / suggestedStrikes[0]) * 100).toFixed(1)}% above assignment
                      </p>
                    </div>
                  ))}
                </div>
                <div className="text-sm text-gray-600 space-y-1 pt-2">
                  <p>• Target 30-45 DTE for optimal theta decay</p>
                  <p>• Aim for 1-2% premium per month</p>
                  <p>• Roll up and out if stock rallies</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Wheels Tracker */}
      {activeWheels.length > 0 && (
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Active Wheel Positions ({activeWheels.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {activeWheels.map((position) => (
                <div
                  key={position.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-lg font-bold text-gray-900">{position.ticker}</h4>
                        {getStatusBadge(position.status)}
                      </div>
                      <p className="text-xs text-gray-500">
                        Started: {new Date(position.entryDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePosition(position.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-600">Strike Price</p>
                      <p className="text-sm font-semibold text-gray-900">${position.strikePrice}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Premium</p>
                      <p className="text-sm font-semibold text-primary">${position.premium.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total Premium</p>
                      <p className="text-sm font-semibold text-primary">${position.totalPremium.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Capital</p>
                      <p className="text-sm font-semibold text-gray-900">${position.capital.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {position.status === "csp-active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updatePositionStatus(position.id, "assigned")}
                        className="text-xs"
                      >
                        Mark as Assigned
                      </Button>
                    )}
                    {position.status === "assigned" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updatePositionStatus(position.id, "cc-active")}
                        className="text-xs"
                      >
                        Start Covered Call
                      </Button>
                    )}
                    {(position.status === "cc-active" || position.status === "assigned") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updatePositionStatus(position.id, "closed")}
                        className="text-xs"
                      >
                        Close Position
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Educational Content */}
      <Card className="shadow-sm border-gray-200 bg-blue-50">
        <CardContent className="pt-4">
          <h4 className="font-semibold text-gray-900 mb-2">The Wheel Strategy Explained</h4>
          <div className="text-sm text-gray-700 space-y-2">
            <p>
              <strong>Step 1: Sell Cash-Secured Puts (CSP)</strong> - Collect premium while waiting to buy stock at your
              target price.
            </p>
            <p>
              <strong>Step 2: Get Assigned</strong> - If the stock drops below your strike, you'll be assigned shares at
              a discount (strike - premium).
            </p>
            <p>
              <strong>Step 3: Sell Covered Calls</strong> - Now that you own shares, sell calls to generate additional
              income.
            </p>
            <p>
              <strong>Step 4: Repeat</strong> - If called away, start over with CSPs. If not, keep selling calls and
              collecting premium.
            </p>
            <p className="pt-2 text-xs text-gray-600">
              <strong>Pro Tip:</strong> Choose stocks you're willing to own long-term. The Wheel works best on quality
              companies with moderate volatility.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
