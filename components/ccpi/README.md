# CCPI dashboard modules

Presentational modules extracted from `components/ccpi-dashboard.tsx` during the S-6
size-budget split. Everything here is imported directly by the dashboard — there is no
barrel file, and adding one is discouraged: the last barrel in this directory went
unimported for months while a parallel set of private copies drifted away from it
(AUDIT_BACKLOG P6-29).

## Files

### `indicator-primitives.tsx`
`CCPIIndicatorTooltip`, `CCPIGradientBar`, `CCPIIndicator`, `CCPIBooleanIndicator`.
Pure presentation — no state, no fetching, no scoring.

`CCPIGradientBar` guards its inputs: a non-finite `value`/`min`/`max`, or `max === min`,
renders a muted "No data" bar rather than a bar positioned by a `NaN%` margin. That guard
is the audit rule (missing data is never drawn as a real position), not a cosmetic choice.

### `pillar-bits.tsx`
`PillarProvenanceLine` and `PillarScore`. Both encode audit rules: the provenance line
states how much of a pillar's 100-point weight actually scored and how much was live
versus AI-estimated; `PillarScore` renders an explicit "Insufficient data" when the score
is `null`, never `0` or `NaN`.

### `pillar-momentum.tsx`, `pillar-risk-appetite.tsx`, `pillar-valuation.tsx`, `pillar-macro.tsx`
The four pillar accordion sections, lifted verbatim from the dashboard. Each takes
`{ score, prov, indicators, tooltipsEnabled }` and renders one `AccordionItem` —
presentation only. These are the exact units the CCPI_DESIGN Phase 2 restructure
reassigns (Momentum → Coincident, Valuation → Vulnerability), which is why they were
extracted ahead of it.

### `trigger-section.tsx`
The Phase 2 TRIGGER section (CCPI_DESIGN.md §7a): one row per signal from
`/api/ccpi-signals` — state, reading and date, meaning, and record ("lead: untested"
until the backtest confirms one). The header is a count, never a composite; NO DATA is
never rendered as QUIET; row order is the API's (grouped by data source), never
"importance".

### `tooltip-copy.ts`
`getSignalTooltip` and `getCrashAmplifierTooltip` — the long-form explanatory strings for
warning signals and crash amplifiers, kept out of the component files so the dashboard
stays inside its line budget.

## Rules for this directory

- Presentation only. Scoring lives in `lib/ccpi/scoring.ts`, types in `lib/ccpi/types.ts`.
- Import modules by path from `ccpi-dashboard.tsx`. No barrel.
- Never render a missing value as a number. Return the "no data" branch instead.
