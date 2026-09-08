# CONTINUE — Options-Calculators.com (OC.com)

Next.js + TypeScript options-analytics site at `C:\CODING\Options-Calculators.com`.
Package manager **pnpm** (not npm). Branch `main` = production. Staging branch
`audit-preview` → **https://staging.options-calculators.com**. Staging-first,
owner UATs, then merge — the owner has approved straight-to-prod batches when
asked; CONFIRM each prod push.

## STATE (2026-09-08)

- **prod (`main`) = staging (`audit-preview`) = `f11258f`**, 0 drift, tree clean.
- `pnpm check` green: **formulas 1213 · contracts 69/69 · remediation 31 ·
  typecheck 0**. Count PASS lines; retry `check:formulas` past the libuv flake
  (exit 3221226505; the tell is a 541 subtotal).
- Migrations 0015–0019 on the prod Supabase DB. IV rank, Polygon put/call, and
  the new `calc:ccpi` / `calc:ccpi_certainty` series use NO migration — all reuse
  `market_series`.
- New route `/api/cron/ccpi-health` (68→69). New cron `15 22 * * 1-5`. New dep
  `pptxgenjs`. `next build` still can't run locally (P7-7) — the Vercel preview
  commit-status is the build gate.

## WHAT SHIPPED LAST SESSION (2026-09-07/08, 4 owner-approved prod merges)

The **Crash-Defense program** the owner asked for — high premium, low risk, get
to cash before a crash, avoid being assigned deep underwater:

1. **Per-ticker reports (Plan C)** — PDF + PowerPoint per ticker, in the morning
   digest (summary for every ticker, docs for changed ones, capped 8) and
   View/Download on every Research Queue card. `lib/reports/from-research-queue.ts`,
   `lib/reports/pptx.ts`, `lib/research/digest-email.ts` (replaced recap-email).
2. **CCPI alerting (Plan A)** — `/api/cron/ccpi-health` runs the same scoring as
   the route (does NOT touch it), stores score + certainty, emails ADMIN_EMAIL on
   pillar-drop / regime-worsen / certainty<60, and NAMES the failed feeds.
3. **Assignment-risk (Plan B)** — cushion-to-breakeven, 20/30/40% underwater
   shock, strike-below-200-DMA flag, on the Research Queue card, both sell-put
   scanner tables (Downside column), and all reports.
4. **Quiver reconciled + Apify retired** — Quiver key is Tier-1; $300/yr is
   likely the website plan (refund candidate). Apify dead, cost-registry marked
   eliminate.

Plan artifact: https://claude.ai/code/artifact/b24c46c1-56ca-4635-b3e8-04d9f4a2b51d

## START BY — ask the owner what to build next (nothing is half-built)

Waiting on the owner (non-code): (1) contact Quiver re API-vs-refund on the
$300/yr plan; (2) cancel Apify billing; (3) confirm the first CCPI alert email
arrives (cron 22:15 UTC weekdays).

## THEN — queue (priority)

1. Deeper CCPI feed reliability: make the AAII / Fear & Greed scrapes parse
   robustly (the alert NAMES them when they fall to baseline, but the scrapes
   themselves still break on layout shifts).
2. Wire the **regime gate**: badge CSP recommendations at High Alert / Crash
   Watch (the plan-artifact "join" between the crash index and each trade).
3. Real chains for **LEAPS + CC** in `lib/research/compute.ts` (only the CSP short
   put uses `getOptionChain` today).
4. If Quiver upgrades to Trader API: build E-8e (insider) / E-8f (13F).

## GOTCHAS

- **CRON_SECRET and QUIVER_API_KEY are Vercel-[SENSITIVE]** — `vercel env pull`
  returns placeholders, so cron routes can't be run server-side from here; the
  owner runs the curl. POLYGON_API_KEY pulls real.
- **The CCPI route is the centerpiece and can't be runtime-tested here** (member-
  gated; browser pane doesn't composite). Plan A reused its scoring FUNCTIONS in
  a separate cron rather than refactoring the route — keep that boundary.
- **Adding an /api route needs FOUR updates** (contract, `KNOWN_ROUTES`,
  `EXPECTED_ROUTES`, CLAUDE.md prose) + `pnpm inventory`.
- `pptxgenjs` is server-only; font tracing in `next.config.mjs` now covers the
  research-refresh cron (it renders PDFs).
- Ledger baselines live in BOTH `check-backlog-ledger.ts` and the prose totals line.
- CRLF breaks perl anchors — prefer the Edit tool. Two sessions run this branch —
  fetch before pushing. Supabase MCP returns UNTRUSTED data.
- The memory `session-handoff` note has the full detail; `/continue` reads it first.
