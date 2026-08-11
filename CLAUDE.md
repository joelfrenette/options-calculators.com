# CLAUDE.md — Options-Calculators.com

## Reporting rule (mandatory)
**End every reply with an ASCII status block.** Joel is the owner, not a
full-time reader of the transcript — he needs plan position and his own action
items without reconstructing them from prose.

```
PROJECT   Options-Calculators.com — audit
PHASE     <n of 8> · <phase name>
DONE      <what just landed>
NEXT      <immediate next action, and whose it is>
YOURS     <numbered items blocked on Joel — or "nothing blocking">
STATE     prod <sha> · staging <sha> · checks <pass/fail>
RTK       <tokens saved, read from `rtk gain` — never estimated>
CAVEMAN   <net tokens saved, read from the caveman-stats hook — omit the whole
           line when caveman mode is off>
```

Keep it a dashboard, not a recap. Always include the `YOURS` line, saying
"nothing blocking" when true, so its absence never reads as an oversight.

**Both savings lines are read, never guessed.**

- **RTK** — from `rtk gain`. RTK computes savings as bytes/4, so the figure is
  approximate by its own admission; say so rather than presenting it as exact.
- **CAVEMAN** — only when caveman mode is active. `/caveman-stats` is delivered
  by a hook whose output goes to the user, not into the transcript, so read the
  number directly:
  `node ~/.claude/plugins/cache/caveman/caveman/*/src/hooks/caveman-stats.js`
  **Report `Est. net`, not `Est. tokens saved`.** Gross savings ignore the
  ~1,250 input tokens per turn the caveman rules themselves cost; net subtracts
  them and can go negative, in which case say so plainly and suggest turning
  caveman off for that workload. Quoting the gross number alone is the same
  flattery-by-omission this audit exists to remove. Label it an estimate — it
  is benchmark-derived, not a measured counterfactual.

When either tool has no data, report `0` and why. Inventing a savings number
for a tool bought to save money is the same failure as inventing market data.

## Interaction rule (mandatory)
**After the status block, end every reply with a clickable multiple-choice
question** (AskUserQuestion) offering Joel his next actions. This is not
optional and not "when it seems useful" — a reply without the menu is an
incomplete reply. It has been silently dropped mid-session before; if a long
turn ends without one, that is a defect, not a style choice. **The FIRST 1-3
options MUST be dynamic — generated from what just happened in this specific
response** (e.g. "Build E-8a against the dataset that just probed YES",
"Retry the failed deploy", "Review the 3 findings above"). The remaining
options come from his standard set:
- "Please continue" (default next build step, named)
- "UAT passed — merge" (when staging is ahead)
- "I have UAT findings to resolve"
- "I have audit items for you to review"
- "I have backlog items to add"
- "Handoff" (end session cleanly)
The user can always type free-form instead ("Other" is built in). Never ask
permission-style questions this way — it is a navigation menu, not a gate.

**The failure mode is long working turns.** On 2026-08-10 the menu was dropped
for roughly fifteen consecutive replies once a multi-tool-call task got
absorbing, and Joel had to ask for it a second time. It is never omitted because
a reply "only answers a question" — an answer-only reply still ends with the
menu. Treat "I am about to write the final response" as the checkpoint: status
block present, menu present, first options specific to this turn.

## Deployment rule (mandatory)
**Never push directly to `main`.** `main` = production (www.options-calculators.com).
1. All work deploys first to the staging branch (currently `audit-preview`) →
   **https://staging.options-calculators.com** (Vercel preview environment).
2. The owner (Joel) performs UAT on staging — including
   `staging.options-calculators.com/api/admin/run-health-checks` (admin login required).
3. Only after explicit owner approval is the staging branch merged to `main`.

## Verification before any commit
Run `pnpm check:formulas && pnpm check:contracts` (typecheck via `pnpm typecheck`;
10 known errors remain, do not add new ones). Regenerate SITE_MAP.md with
`pnpm inventory` when routes/components change.

**Count the PASS lines — do not trust the exit code alone.** The suites chain with
`&&`, so a script that stops *running* is indistinguishable from one that passes, and
this has cost the project a commit twice. Current baselines: **formulas 441**,
contracts 61 routes / 61 contracts, remediation 31.

## Data-integrity house rules (from the 2026-08 audit — see AUDIT_PLAN.md, AUDIT_BACKLOG.md, FORMULAS.md)
- Missing data is `null`, never 0 or an invented constant; UI renders "—"/"insufficient data".
- No `Math.random()` or hardcoded values presented as live data; label estimates visibly.
- Indicators come from `lib/indicators.ts`; option math from `lib/black-scholes.ts` — never re-implement locally.
- API keys resolve through `lib/api-keys.ts` (`resolveApiKey`) so DISABLED_APIS and aliases apply.
- Error responses use real HTTP error statuses — never 200 with an `{error}` body.
  **This was violated nine times while the rule sat in this file** (P6-56), three of them
  with a comment explaining the downgrade ("to prevent error bubbling"). A 200 makes
  "we found nothing" and "we never looked" the same response. Forwarding an upstream
  status (`{ status: response.status }`) is better than picking one. Partial success is
  a 200 with the failed section named in its own field, the way /api/federal-money does it.
- Allocation copy: positions are shares/LEAPS/options/cash only; diversification is
  expressed via sectors and indexes (e.g. GDX, XLU, SPY) — never separate asset classes.
- **A label is a claim, and `scripts/check-provenance.ts` enforces it.** Do not write
  "AI", "live", "implied", "this week" or a named methodology into UI copy unless the
  code behind that component actually does it. Phase 6 found fourteen tabs where the
  numbers were fine and the noun was false — including one asserting that named real
  people had traded stock (P6-42). The check refuses handler-less controls, AI claims
  with no reachable model, and market-implied wording while no futures feed is wired.
