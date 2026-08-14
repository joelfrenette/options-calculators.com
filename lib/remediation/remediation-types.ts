/**
 * Input and output shapes for the remediation engine. Split from
 * lib/remediation.ts (P6-13); see that file's header for the input contract.
 */

// ---------------------------------------------------------------- input types

export type ProbeStatus = "pass" | "fail" | "degraded" | "skipped" | "blocked"

/** Mirrors `Result` in app/api/admin/run-health-checks/route.ts. */
export interface HealthResult {
  path: string
  method: string
  status: ProbeStatus
  httpStatus: number | null
  latencyMs: number | null
  budgetMs: number
  overBudget: boolean
  tabs: string[]
  detail: string | null
  schemaIssues?: string[]
  missingKeys?: string[]
}

/** Mirrors one entry of the health report's `keys` array. */
export interface KeySummary {
  name: string
  aliases: string[]
  /** Which alias spelling is actually set in the environment, if any. */
  resolvedVia: string | null
  configured: boolean
  disabled: boolean
  gates: string[]
}

export interface DiagnoseContext {
  keys?: KeySummary[]
}

// --------------------------------------------------------------- output types

/**
 * Who has to act:
 *   owner    — Joel: a dashboard, a billing page, an env var, a decision.
 *   claude   — a code change in this repo.
 *   upstream — nobody here: the provider is having a moment. Wait, re-check.
 */
export type RemediationOwner = "owner" | "claude" | "upstream"

export interface RemediationLink {
  label: string
  url: string
}

export interface Remediation {
  owner: RemediationOwner
  confidence: "certain" | "likely"
  /** One line, plain English, no jargon. */
  headline: string
  /** What the symptom actually means. */
  why: string
  /** Ordered, concrete, copy-pasteable where possible. Never empty. */
  steps: string[]
  /** Self-contained prompt the owner can paste into Claude Code. */
  claudePrompt?: string
  links?: RemediationLink[]
  /** True when a code change alone deterministically fixes it. */
  autoFixable: boolean
}
