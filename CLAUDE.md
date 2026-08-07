# CLAUDE.md — Options-Calculators.com

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
