# CCPI API Usage Guide

Complete guide for using the CCPI data layer in your components.

## Quick Start

\`\`\`typescript
import { 
  fetchCCPI, 
  refreshCCPIData,
  saveCCPIToCache,
  loadCCPIFromCache 
} from "@/lib/ccpi"

// Simple fetch
const data = await fetchCCPI()

// Complete refresh with caching and summary
const { data, summary } = await refreshCCPIData()

// Cache management
const cached = loadCCPIFromCache()
if (cached) {
  // Use cached data
} else {
  // Fetch fresh
}
\`\`\`

## API Functions

### Core Data Fetching

#### `fetchCCPI(): Promise<CCPIData>`
Fetches current CCPI data from the API.

\`\`\`typescript
try {
  const data = await fetchCCPI()
  console.log("CCPI Score:", data.ccpi)
} catch (error) {
  console.error("Failed to fetch CCPI:", error)
}
\`\`\`

#### `fetchCCPIHistory(): Promise<HistoricalData>`
Fetches historical CCPI data for charting.

\`\`\`typescript
const history = await fetchCCPIHistory()
console.log("Historical dates:", history.dates)
\`\`\`

#### `fetchExecutiveSummary(ccpiData: CCPIData): Promise<string>`
Generates AI executive summary using Grok.

\`\`\`typescript
const summary = await fetchExecutiveSummary(data)
console.log("AI Summary:", summary)
\`\`\`

#### `refreshCCPIData(): Promise<{ data: CCPIData; summary: string | null }>`
Complete refresh operation - fetches data, caches it, and generates summary.

\`\`\`typescript
const { data, summary } = await refreshCCPIData()

// Data is automatically cached
// Summary may be null if AI generation fails
\`\`\`

---

### Caching

#### `saveCCPIToCache(data: CCPIData): boolean`
Saves CCPI data to localStorage.

\`\`\`typescript
const success = saveCCPIToCache(data)
if (!success) {
  console.warn("Failed to cache data")
}
\`\`\`

#### `loadCCPIFromCache(): CCPIData | null`
Loads CCPI data from localStorage.

\`\`\`typescript
const cached = loadCCPIFromCache()
if (cached) {
  console.log("Using cached data from:", cached.timestamp)
}
\`\`\`

#### `isCacheFresh(cachedAt: string, maxAgeMinutes: number): boolean`
Checks if cached data is still fresh.

\`\`\`typescript
if (cached && isCacheFresh(cached.cachedAt, 5)) {
  // Use cached data (less than 5 minutes old)
} else {
  // Fetch fresh data
}
\`\`\`

---

### Progress Tracking

#### `startProgressSimulation(onProgress: ProgressCallback): () => void`
Simulates progress updates during data fetch.

\`\`\`typescript
const stopProgress = startProgressSimulation((progress, status) => {
  setRefreshProgress(progress)
  setRefreshStatus(status)
})

// Later: stop the simulation
stopProgress()
\`\`\`

#### `completeProgress(onProgress: ProgressCallback): void`
Completes progress animation to 100%.

\`\`\`typescript
completeProgress((progress, status) => {
  setRefreshProgress(progress) // 100
  setRefreshStatus(status) // "Complete!"
})
\`\`\`

---

### Logging

#### `logCCPIDataLoaded(data: CCPIData): void`
Logs comprehensive CCPI data summary.

\`\`\`typescript
logCCPIDataLoaded(data)
// [v0] CCPI Data Loaded: { ccpi: 45, certainty: 78, ... }
\`\`\`

#### `logPillarBreakdown(data: CCPIData): void`
Logs pillar contributions with weighted calculations.

\`\`\`typescript
logPillarBreakdown(data)
// Pillar Breakdown (weighted contribution to CCPI):
//   Momentum: 65 × 35% = 22.8
//   Risk Appetite: 42 × 30% = 12.6
//   ...
\`\`\`

---

## Complete Example: Component Integration

\`\`\`typescript
"use client"

import { useState, useEffect } from "react"
import {
  type CCPIData,
  refreshCCPIData,
  loadCCPIFromCache,
  saveCCPIToCache,
  startProgressSimulation,
  completeProgress,
  logCCPIDataLoaded,
  logPillarBreakdown,
  logError,
} from "@/lib/ccpi"

export function CCPIDashboard() {
  const [data, setData] = useState<CCPIData | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")

  useEffect(() => {
    // Load cached data first
    const cached = loadCCPIFromCache()
    if (cached) {
      setData(cached)
    }
    
    // Fetch fresh data
    handleRefresh()
  }, [])

  const handleRefresh = async () => {
    try {
      setLoading(true)
      
      // Start progress simulation
      const stopProgress = startProgressSimulation((p, s) => {
        setProgress(p)
        setStatus(s)
      }, 5, 90)

      // Fetch data
      const { data: freshData, summary } = await refreshCCPIData()
      
      // Stop progress simulation
      stopProgress()
      completeProgress((p, s) => {
        setProgress(p)
        setStatus(s)
      })

      // Update state
      setData(freshData)
      
      // Save to cache
      saveCCPIToCache(freshData)
      
      // Log results
      logCCPIDataLoaded(freshData)
      logPillarBreakdown(freshData)
      
    } catch (error) {
      logError("Failed to refresh CCPI", error)
    } finally {
      setLoading(false)
      setProgress(0)
      setStatus("")
    }
  }

  return (
    <div>
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div 
            className="h-2 bg-blue-500" 
            style={{ width: \`\${progress}%\` }}
          />
          <p className="text-center">{status}</p>
        </div>
      )}
      
      {data && (
        <div>
          <h1>CCPI: {data.ccpi}</h1>
          <p>Regime: {data.regime.name}</p>
          <button onClick={handleRefresh}>Refresh</button>
        </div>
      )}
    </div>
  )
}
\`\`\`

---

## Error Handling

All API functions throw errors that should be caught:

\`\`\`typescript
try {
  const data = await fetchCCPI()
} catch (error) {
  if (error instanceof Error) {
    console.error("Error message:", error.message)
  }
  // Show error UI to user
}
\`\`\`

---

## Best Practices

1. **Always cache data** - Reduces API calls and improves UX
2. **Check cache freshness** - Use `isCacheFresh()` before deciding to fetch
3. **Handle errors gracefully** - Network failures should not crash the app
4. **Use progress indicators** - Provide feedback during long operations
5. **Log important events** - Use logger utilities for debugging

---

## Performance Tips

- **Parallel operations**: Fetch CCPI and history simultaneously
  \`\`\`typescript
  const [ccpi, history] = await Promise.all([
    fetchCCPI(),
    fetchCCPIHistory()
  ])
  \`\`\`

- **Debounce refreshes**: Prevent rapid successive API calls
  \`\`\`typescript
  import { useDebouncedCallback } from 'use-debounce'
  
  const debouncedRefresh = useDebouncedCallback(
    handleRefresh,
    500
  )
  \`\`\`

- **Background updates**: Update cache without blocking UI
  \`\`\`typescript
  // Fire and forget
  refreshCCPIData().then(({ data }) => {
    saveCCPIToCache(data)
  })
  \`\`\`
\`\`\`
