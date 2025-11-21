// Progress tracking utilities for CCPI data refresh
// Simulates progress updates during API calls

import { REFRESH_STATUS_MESSAGES } from "./constants"

export type ProgressCallback = (progress: number, status: string) => void

/**
 * Simulates progress updates during data fetch
 * Returns cleanup function to stop the interval
 */
export function startProgressSimulation(onProgress: ProgressCallback, startProgress = 5, maxProgress = 90): () => void {
  let currentProgress = startProgress

  const interval = setInterval(() => {
    if (currentProgress >= maxProgress) {
      return
    }

    // Random increment between 5-13%
    currentProgress += Math.random() * 8
    currentProgress = Math.min(currentProgress, maxProgress)

    // Random status message
    const status = REFRESH_STATUS_MESSAGES[Math.floor(Math.random() * REFRESH_STATUS_MESSAGES.length)]

    onProgress(currentProgress, status)
  }, 800)

  // Return cleanup function
  return () => clearInterval(interval)
}

/**
 * Completes progress animation
 */
export function completeProgress(onProgress: ProgressCallback): void {
  onProgress(100, "Complete!")
}
