# CCPI Foundation Layer

This directory contains the foundational utilities, types, and constants for the CCPI (Crash Confidence Probability Index) system.

## Structure

- **`types.ts`** - TypeScript interfaces and type definitions
- **`constants.ts`** - Thresholds, weights, color mappings, and configuration
- **`calculations.ts`** - Pure calculation and utility functions
- **`cache.ts`** - LocalStorage caching utilities

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
