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
```

Keep it a dashboard, not a recap. Always include the `YOURS` line, saying
"nothing blocking" when true, so its absence never reads as an oversight.

**The RTK line is measured, never guessed.** Read it from `rtk gain`. RTK
computes savings as bytes/4, so the figure is approximate by its own admission —
say so rather than presenting it as an exact count. When there is no tracking
data, report `0` and why. Inventing a savings number for a tool bought to save
money is the same failure as inventing market data.

## Deployment rule (mandatory)
**Never push directly to `main`.** `main` = production (www.options-calculators.com).
1. All work deploys first to the staging branch (currently `audit-preview`) →
   **https://staging.options-calculators.com** (Vercel preview environment).
2. The owner (Joel) performs UAT on staging — including
   `staging.options-calculators.com/api/admin/run-health-checks` (admin login required).
3. Only after explicit owner approval is the staging branch merged to `main`.

## Verification before any commit
Run `pnpm check:formulas && pnpm check:contracts` (typecheck via `pnpm typecheck`;
~20 known errors remain, do not add new ones). Regenerate SITE_MAP.md with
`pnpm inventory` when routes/components change.

## Data-integrity house rules (from the 2026-08 audit — see AUDIT_PLAN.md, AUDIT_BACKLOG.md, FORMULAS.md)
- Missing data is `null`, never 0 or an invented constant; UI renders "—"/"insufficient data".
- No `Math.random()` or hardcoded values presented as live data; label estimates visibly.
- Indicators come from `lib/indicators.ts`; option math from `lib/black-scholes.ts` — never re-implement locally.
- API keys resolve through `lib/api-keys.ts` (`resolveApiKey`) so DISABLED_APIS and aliases apply.
- Error responses use real HTTP error statuses — never 200 with an `{error}` body.
- Allocation copy: positions are shares/LEAPS/options/cash only; diversification is
  expressed via sectors and indexes (e.g. GDX, XLU, SPY) — never separate asset classes.
