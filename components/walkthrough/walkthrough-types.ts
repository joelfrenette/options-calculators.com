/**
 * The shapes the trade walkthrough passes between its parts.
 *
 * Split out of `components/trade-walkthrough-modal.tsx` (P6-13) unchanged, and
 * into their own file rather than staying in the modal: the mockups need
 * `WalkthroughSetup` and the modal needs the mockups, so leaving the type in the
 * modal would have made the import circular.
 *
 * `components/trade-walkthrough-modal.tsx` re-exports `WalkthroughSetup`, so
 * every existing importer keeps working unchanged.
 */

export interface WalkthroughSetup {
  ticker: string
  setup: string
  credit: string
  pop: string
  direction: string
  signal?: string
}

export type CoachKind = "say" | "why" | "tip" | "warn"
export type ScreenKind = "intro" | "trade-tab" | "chain" | "ticket" | "confirm" | "manage"

export interface CoachLine {
  kind: CoachKind
  text: string
}

export interface WalkStep {
  title: string
  screen: ScreenKind
  coach: CoachLine[]
}
