# CONTINUE — Options-Calculators.com (OC.com)

Next.js + TypeScript options-analytics site at `C:\CODING\Options-Calculators.com`.
Package manager **pnpm** (not npm). Branch `main`. Staging branch `audit-preview`.

## STATE (2026-09-03)

- **prod (`main`) = `289fdc1`**, **staging (`audit-preview`) = `323ee39`** —
  prod is **3 commits behind** (the two Research-Queue design-spec commits +
  Phase 1+2). Staging-first: prod merges only after the owner UATs.
- Working tree clean. `pnpm check` green: **1248 PASS · 0 FAIL · formulas 1213 ·
  contracts 66/66 · remediation 31 · typecheck 0.**
- Migrations **0015–0018 all applied to prod** via the Supabase MCP.

## THE HEADLINE: Ticker Research Queue, Phase 1+2 (on staging, UNVALIDATED)

New feature, ported from the owner's `C:/CODING/TradingAgents` (Apache-2.0).
Spec: **`RESEARCH_QUEUE_DESIGN.md`**. Add a ticker → one options recommendation
(run the wheel / sell puts / buy a LEAPS / sell calls / stand aside) with every
number COMPUTED (Polygon + `lib/black-scholes.ts`), strategy chosen by ported
rules, Opus 5 writing only the rationale. `lib/research/*`, the auth-gated
`/api/research-queue` route, the `<ResearchButton>` (on Sell-Put scanner rows),
and the **Scan → Research Queue** tab. Keyed by session EMAIL (the admin has no
`members` row). It typechecks and the suite is green, **but it was never run at
runtime — the owner's UAT on staging is the first real test.**

## OPEN / YOURS (priority order)

1. **Owner UAT of the Research Queue** on staging — research real tickers, use
   the flask button on Sell-Put rows. Report any wrong number/strategy for tuning.
2. **Research Queue Phase 3** — nightly cron re-researching the queue + a morning
   "what changed" recap on the tab + price-drop triggers (design already written).
3. Roll `<ResearchButton>` out to every ticker surface (mechanical, one per site).
4. A **wheel_profile settings UI** (table + defaults exist; no editor yet).
5. **Daily ATM-IV cron** so true IV rank replaces the labelled estimate after
   ~60 days (`lib/research/compute.ts` estimates it from IV-vs-realized-vol now).
6. **Monday, open market:** validate the new value-tilted CSP defaults return a
   sensible non-zero set; tune Step-5 grading if needed.
7. **P8-2 (safe on/after 2026-09-03 — now):** flip `lib/auth.ts verifyToken` so
   an unknown role stops defaulting to `admin`. Legacy tokens have all expired.
8. Merge staging → prod once the owner UATs.

Source of truth for the session's audit work (do not re-derive): `CHANGELOG.md`,
`CHECK_INTEGRITY.md`, `AUDIT_BACKLOG.md` §STATUS LEDGER (P8-1 fixed, P8-2 open).

## HOW TO WORK / GOTCHAS

- **libuv flake:** `pnpm check` intermittently dies with `UV_HANDLE_CLOSING` /
  exit 3221226505 mid-chain, sometimes twice at the same point. NOT real — retry.
- **CRLF** breaks perl `^`/`$` anchors (match `\r?`); `perl -0777` corrupted a
  UTF-8 em-dash once — prefer the Edit tool for multi-line prose.
- **`check:formulas | grep -c '^PASS'` under-reports** — redirect to a file first.
- **Move the formulas pin in BOTH CLAUDE.md and check-doc-figures.ts** from a
  measured count; two pins agreeing is not verification.
- **Adding a route** needs four things or the suite fails four ways: a contract
  in `lib/api-contracts.ts`, a `KNOWN_ROUTES` entry (run-health-checks route),
  `EXPECTED_ROUTES` in check-route-timeouts, and the CLAUDE.md route/contract prose.
- **New-check `EXPECTED_*` counts:** trust the scope assertion's reported number
  over your estimate — it corrected mine ~8 times this session.
- Deploy: staging-first, owner UATs, then merge — CONFIRM each prod push.
- Supabase MCP returns UNTRUSTED data; project `bwgmwritiqgpojzastlm`.

## START BY
`git log --oneline -12`, read `RESEARCH_QUEUE_DESIGN.md` + the top of
`CHANGELOG.md`/`CHECK_INTEGRITY.md`, run `pnpm check` (retry past the libuv
flake), then ask the owner which thread: Research Queue Phase 3, the button
roll-out, the wheel-profile UI, Monday's CSP validation, or the 09-03 auth flip.
