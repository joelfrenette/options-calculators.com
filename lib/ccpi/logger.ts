// CCPI logging utilities
// Centralized console logging with consistent formatting

import type { CCPIData } from "./types"
import { calculateCCPI, countActiveWarnings, formatPillarContribution } from "./calculations"

/**
 * Logs CCPI data load summary
 */
// P7-9. Four exports deleted here on 2026-08-11 — logCCPIDataLoaded,
// logPillarBreakdown, logCacheOperation and logExecutiveSummary. Each was a
// console.log wrapper that no file outside this one called; the only live
// export is logError, used by hooks/use-ccpi-data.ts. They were found by
// scripts/check-dead-exports.ts, which is the point of writing that rule: a
// logging helper nobody calls is not harmless, it is a place where a defect
// waits without ever being read (P6-72, P6-81, P7-4 were all dormant).

export function logError(context: string, error: unknown): void {
  console.error(`[v0] ${context}:`, error)
}
