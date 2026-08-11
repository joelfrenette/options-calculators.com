# CCPI Foundation Layer

This directory contains the foundational utilities, types, and constants for the CCPI (Crash Confidence Probability Index) system.

## Structure

- **`types.ts`** - TypeScript interfaces and type definitions
- **`constants.ts`** - Thresholds, weights, color mappings, and configuration
- **`calculations.ts`** - Pure calculation and utility functions
- **`cache.ts`** - LocalStorage caching utilities

Cash-vs-stocks allocation is **not** here — it lives in `lib/allocation.ts`, one level up,
because market sentiment needs the same primitives on a different scale. **Cash is the only
stored figure**; stocks is computed as its complement, so the two halves cannot drift apart.
Import `CCPI_ALLOCATION` for the crash-risk bands.

## Usage

### Importing Types

\`\`\`typescript
import type { CCPIData, CCPIRegimeZone } from "@/lib/ccpi/types"
\`\`\`

### Using Constants

\`\`\`typescript
import { CCPI_THRESHOLDS, PILLAR_WEIGHTS, COLOR_MAP } from "@/lib/ccpi/constants"

// Check if CCPI is in danger zone
if (ccpiValue >= CCPI_THRESHOLDS.CRASH_WATCH) {
  // Alert user
}
\`\`\`

### Calculation Functions

\`\`\`typescript
import {
  getRegimeZone,
  calculateCCPI,
  sortCanaries,
  getIndicatorStatus,
} from "@/lib/ccpi/calculations"

// Get regime information
const zone = getRegimeZone(75) // { color: "orange", label: "HIGH ALERT" }

// Calculate CCPI from pillars
const ccpi = calculateCCPI({
  momentum: 80,
  riskAppetite: 70,
  valuation: 60,
  macro: 65,
})

// Sort canaries by severity and impact
const sorted = sortCanaries(data.canaries)
\`\`\`

### Caching Functions

\`\`\`typescript
import {
  saveCCPIToCache,
  loadCCPIFromCache,
  isCacheFresh,
} from "@/lib/ccpi/cache"

// Save data to localStorage
saveCCPIToCache(ccpiData)

// Load from cache
const cached = loadCCPIFromCache()

// Check if cache is still fresh
if (cached && isCacheFresh(cached.cachedAt, 5)) {
  // Use cached data
}
\`\`\`

## Design Principles

1. **Pure Functions** - All calculation functions are pure (same input = same output)
2. **Type Safety** - Comprehensive TypeScript types for all data structures
3. **Centralized Config** - All magic numbers and thresholds in one place
4. **Testable** - Pure functions are easy to unit test
5. **Reusable** - Can be imported across components, pages, and API routes

## Migration Notes

These utilities were extracted from `components/ccpi-dashboard.tsx` to improve:
- Code reusability
- Testability
- Maintainability
- Type safety

The original component will be gradually refactored to use these utilities.

## There is no barrel here, and that is deliberate

`lib/ccpi/index.ts` was deleted on 2026-08-11 (P7-9). It re-exported six modules
and **nothing imported it** — a repo-wide search for `@/lib/ccpi"` returned zero
runtime referrers; its only mentions were in `API_USAGE.md`, which documented an
import style nobody used.

This is the second time this directory has grown an unused indirection layer.
P6-29 deleted seven duplicate components and their barrel here for the same
reason, and the note that survived that clean-up applies again: **a barrel makes
every module in a directory look reachable, which is exactly what hides the ones
that are not.** The dead-export rule (`scripts/check-dead-exports.ts`) cannot see
past one either, since `export * from "./x"` names no symbols.

Import the module you need directly — `@/lib/ccpi/scoring`, `@/lib/ccpi/cache`,
and so on. The examples in `API_USAGE.md` that import from `@/lib/ccpi` are
historical and do not resolve.
