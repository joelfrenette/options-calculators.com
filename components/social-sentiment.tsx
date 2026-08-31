"use client"

import { useEffect, useState, useCallback } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DataLoadGate } from "@/components/data-load-gate"
import { HeadlineCard } from "./social-sentiment/headline-card"
import { IndexHeatmapCard } from "./social-sentiment/index-heatmap-card"
import { IndicatorsCard } from "./social-sentiment/indicators-card"
import { AiSummaryCard } from "./social-sentiment/ai-summary-card"
import type { SentimentData, SentimentIndicator } from "./social-sentiment/sentiment-types"

export function SocialSentiment() {
  const [data, setData] = useState<SentimentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingSource, setLoadingSource] = useState("")
  const [isFromCache, setIsFromCache] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [needsInitialFetch, setNeedsInitialFetch] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const CACHE_KEY = "social_sentiment_cache_v6"
  const CACHE_TIMESTAMP_KEY = "social_sentiment_cache_timestamp_v6"

  const fetchSentiment = useCallback(async () => {
    setLoading(true)
    setLoadingProgress(0)
    setIsFromCache(false)

    const sources = [
      "Initializing...",
      "Fetching StockTwits tags...",
      "Fetching Finnhub news...",
      "Fetching Polygon news...",
      "Calculating News Fear & Greed...",
      "Generating AI summary...",
      "Finalizing data...",
    ]

    let progress = 0
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15
      if (progress > 90) progress = 90
      setLoadingProgress(Math.min(progress, 90))
      const sourceIndex = Math.floor((progress / 100) * sources.length)
      setLoadingSource(sources[Math.min(sourceIndex, sources.length - 1)])
    }, 300)

    try {
      const response = await fetch("/api/social-sentiment")

      clearInterval(progressInterval)
      setLoadingProgress(95)
      setLoadingSource("Processing results...")

      setFetchError(null)
      if (response.ok) {
        const result = await response.json()
        setData(result)
        setLastUpdated(new Date())
        localStorage.setItem(CACHE_KEY, JSON.stringify(result))
        localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
        setLoadingProgress(100)
        setLoadingSource("Complete!")
      } else {
        console.error("[v0] Social sentiment API error:", response.status)
        setFetchError(`Sentiment API returned HTTP ${response.status}. Showing cached data if available.`)
      }
    } catch (error) {
      clearInterval(progressInterval)
      console.error("[v0] Error fetching social sentiment data:", error)
      setFetchError("Could not reach the sentiment API. Data shown may be stale.")
    } finally {
      setTimeout(() => {
        setLoading(false)
        setLoadingProgress(0)
        setLoadingSource("")
      }, 500)
    }
  }, [])

  useEffect(() => {
    if (!loaded) return

    const cached = localStorage.getItem(CACHE_KEY)
    const cacheTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)

    // AGE, not just presence. `cacheTimestamp` was read only to render "last
    // updated" — the decision to serve the cache was `if (cached)` and nothing
    // else, so a social-sentiment reading from any distance in the past
    // rendered as current beside an accurate timestamp nothing compared against
    // the clock. Ninth instance of this shape found 2026-08-30.
    //
    // Four hours, matching the CCPI and Fear & Greed caches: this is a
    // slow-moving sentiment reading, not strike-level option pricing (the
    // scanner caches use thirty minutes for that reason).
    const CACHE_TTL_MS = 4 * 60 * 60 * 1000
    const savedAtMs = cacheTimestamp ? Number.parseInt(cacheTimestamp, 10) : Number.NaN
    const cacheIsFresh = Number.isFinite(savedAtMs) && Date.now() - savedAtMs <= CACHE_TTL_MS

    if (cached && cacheIsFresh) {
      try {
        setData(JSON.parse(cached))
        setLastUpdated(new Date(savedAtMs))
        setIsFromCache(true)
      } catch {
        // Cache parse failed, need to fetch
        setNeedsInitialFetch(true)
      }
    } else {
      // No cache exists, need to fetch
      setNeedsInitialFetch(true)
    }
  }, [loaded])

  useEffect(() => {
    if (needsInitialFetch && !loading) {
      fetchSentiment()
      setNeedsInitialFetch(false)
    }
  }, [needsInitialFetch, loading, fetchSentiment])

  const handleRefresh = () => {
    fetchSentiment()
  }

  if (!loaded) {
    return (
      <DataLoadGate
        title="Load Social Sentiment Index?"
        description="Fetch the latest social and macro market sentiment indicators. Nothing loads until you choose to."
        onConfirm={() => setLoaded(true)}
      />
    )
  }

  const HIDDEN_INDICATORS: string[] = []
  const allIndicators = (data?.indicators || []).filter((ind) => !HIDDEN_INDICATORS.includes(ind.name))
  const uniqueIndicators: SentimentIndicator[] = Array.from(
    new Map(
      allIndicators.map((ind) => [
        ind.name,
        {
          name: ind.name,
          score: ind.score ?? 0,
          status: ind.status,
          description: ind.description,
          isLive: ind.status === "LIVE" && ind.score !== null && ind.score >= 0,
        },
      ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name))

  const indexData = (data?.per_symbol || []).filter((s) => ["SPY", "QQQ", "IWM", "DIA"].includes(s.symbol))

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <HeadlineCard
          data={data}
          lastUpdated={lastUpdated}
          isFromCache={isFromCache}
          fetchError={fetchError}
          loading={loading}
          tooltipsEnabled={tooltipsEnabled}
          onToggleTooltips={setTooltipsEnabled}
          onRefresh={handleRefresh}
        />
        <IndexHeatmapCard indexData={indexData} />
        <IndicatorsCard indicators={uniqueIndicators} />
        <AiSummaryCard data={data} lastUpdated={lastUpdated} />
      </div>
    </TooltipProvider>
  )
}
