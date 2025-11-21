"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import type { CCPIData, HistoricalData } from "@/lib/ccpi/types"
import { fetchCCPI, fetchExecutiveSummary, fetchHistory, refreshCCPIData } from "@/lib/ccpi/api"
import { getCachedData, setCachedData, hasFreshCache } from "@/lib/ccpi/cache"
import { log } from "@/lib/ccpi/logger"

interface CCPIState {
  data: CCPIData | null
  history: HistoricalData | null
  executiveSummary: string | null
  loading: boolean
  summaryLoading: boolean
  error: string | null
  isRefreshing: boolean
  refreshProgress: number
  refreshStatus: string
  tooltipsEnabled: boolean
}

interface UseCCPIDataReturn extends CCPIState {
  refresh: (forceRefresh?: boolean) => Promise<void>
  toggleTooltips: () => void
  clearError: () => void
}

const INITIAL_STATE: CCPIState = {
  data: null,
  history: null,
  executiveSummary: null,
  loading: false,
  summaryLoading: false,
  error: null,
  isRefreshing: false,
  refreshProgress: 0,
  refreshStatus: "",
  tooltipsEnabled: true,
}

export function useCCPIData(): UseCCPIDataReturn {
  const [state, setState] = useState<CCPIState>(INITIAL_STATE)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      // Check cache first
      const cached = getCachedData()
      if (cached && hasFreshCache()) {
        log("Using cached CCPI data")
        setState((prev) => ({
          ...prev,
          data: cached,
          loading: false,
        }))

        // Load history and summary in background
        loadHistoryAndSummary(cached)
        return
      }

      // Fetch fresh data
      const data = await fetchCCPI()
      setState((prev) => ({
        ...prev,
        data,
        loading: false,
      }))

      setCachedData(data)
      await loadHistoryAndSummary(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load CCPI data"
      log("Error loading initial data:", errorMessage)
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }))
    }
  }

  const loadHistoryAndSummary = async (data: CCPIData) => {
    // Load history
    try {
      const history = await fetchHistory()
      setState((prev) => ({ ...prev, history }))
    } catch (err) {
      log("Error loading history:", err)
    }

    // Load executive summary
    setState((prev) => ({ ...prev, summaryLoading: true }))
    try {
      const summary = await fetchExecutiveSummary(data)
      setState((prev) => ({
        ...prev,
        executiveSummary: summary,
        summaryLoading: false,
      }))
    } catch (err) {
      log("Error loading executive summary:", err)
      setState((prev) => ({
        ...prev,
        summaryLoading: false,
      }))
    }
  }

  const refresh = useCallback(async (forceRefresh = false) => {
    setState((prev) => ({
      ...prev,
      isRefreshing: true,
      refreshProgress: 0,
      refreshStatus: "Fetching CCPI data...",
      error: null,
    }))

    try {
      const data = await refreshCCPIData({
        onProgress: (progress, status) => {
          setState((prev) => ({
            ...prev,
            refreshProgress: progress,
            refreshStatus: status,
          }))
        },
        forceRefresh,
      })

      setState((prev) => ({
        ...prev,
        data,
        isRefreshing: false,
        refreshProgress: 100,
        refreshStatus: "Complete!",
      }))

      setCachedData(data)

      // Reload history and summary
      await loadHistoryAndSummary(data)

      // Reset progress after delay
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          refreshProgress: 0,
          refreshStatus: "",
        }))
      }, 2000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to refresh data"
      log("Error refreshing:", errorMessage)
      setState((prev) => ({
        ...prev,
        isRefreshing: false,
        error: errorMessage,
        refreshProgress: 0,
        refreshStatus: "",
      }))
    }
  }, [])

  const toggleTooltips = useCallback(() => {
    setState((prev) => ({
      ...prev,
      tooltipsEnabled: !prev.tooltipsEnabled,
    }))
  }, [])

  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
    }))
  }, [])

  const memoizedReturn = useMemo(
    () => ({
      ...state,
      refresh,
      toggleTooltips,
      clearError,
    }),
    [state, refresh, toggleTooltips, clearError],
  )

  return memoizedReturn
}
