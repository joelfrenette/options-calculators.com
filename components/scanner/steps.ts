/**
 * The scanner's step numbering, in one place (AUDIT_BACKLOG S-18).
 *
 * WHY THIS EXISTS. The four steps were written as literal "Step N" strings in
 * roughly ninety places across a dozen files, and they had drifted. The
 * clearest instance was user-visible: `loadPreFilteredTickers` is the action
 * behind the button labelled **"Scan for Potential Stocks (Step 2)"**, and when
 * it failed it set the error **"Step 1 failed"**. Its console logs said Step 1
 * too. Separately, the technical-analysis handler logged itself as "Step 3"
 * while its own button and card both say Step 4, and one comment called the
 * fundamental scan "Step 2".
 *
 * None of those numbers is load-bearing on its own, which is exactly why they
 * drifted: nothing breaks when a log line is off by one, so nothing catches it,
 * and the one that reached a user only did so on an error path that most
 * sessions never hit.
 *
 * THE ORDER IS THE CARDS' ORDER. `step1-dollar-filter-card.tsx` through
 * `step4-technical-card.tsx` are the canonical declaration — they are what the
 * user actually reads, and the filenames make the intent unambiguous.
 *
 * NOT A UNIVERSAL "STEP" REGISTRY. `components/wheel-strategy-planner.tsx` and
 * `components/options-strategy-toolbox.tsx` also number steps 1-4 — Sell
 * Cash-Secured Puts, Get Assigned, Sell Covered Calls, Repeat. That is the
 * wheel STRATEGY lifecycle, a different sequence that happens to share the
 * phrasing, and merging the two would be worse than the duplication it removed:
 * "Step 3" would have to mean both "Fundamental Criteria" and "Sell Covered
 * Calls". Those files are deliberately out of scope here and in the check.
 */

export type ScannerStepKey = "dollarFilter" | "preFilter" | "fundamentals" | "technical"

export const SCANNER_STEPS: Record<ScannerStepKey, { n: 1 | 2 | 3 | 4; title: string; action: string }> = {
  /** The price ceiling slider. A filter, not an action — nothing to click. */
  dollarFilter: { n: 1, title: "Dollar Amount Filtering", action: "Set the price ceiling" },
  /** Loads the ticker universe from /api/polygon-tickers. */
  preFilter: { n: 2, title: "Smart Pre-Filtering", action: "Scan for Potential Stocks" },
  /** Fundamental criteria over the loaded universe. */
  fundamentals: { n: 3, title: "Fundamental Criteria", action: "Scan Fundamentals" },
  /** Technical criteria plus options enrichment, including the relaxed flow. */
  technical: { n: 4, title: "Technical Criteria", action: "Run Technical Analysis" },
}

/** "Step 2" — for interpolation into a heading, button or error. */
export const stepLabel = (key: ScannerStepKey): string => `Step ${SCANNER_STEPS[key].n}`

/** "Scan for Potential Stocks (Step 2)" — the button/heading form. */
export const stepTitled = (key: ScannerStepKey, text?: string): string =>
  `${text ?? SCANNER_STEPS[key].action} (${stepLabel(key)})`
