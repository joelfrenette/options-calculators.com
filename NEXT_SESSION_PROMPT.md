# CONTINUE — Options-Calculators.com (OC.com)

Next.js + TypeScript options-analytics site at `C:\CODING\Options-Calculators.com`.
Package manager **pnpm** (not npm). Branch `main` = production. Staging branch
`audit-preview` → **https://staging.options-calculators.com**. Staging-first,
owner UATs, then merge — the owner has approved straight-to-prod batches when
asked; CONFIRM each prod push.

## STATE (2026-09-06)

- **prod (`main`) = staging (`audit-preview`) = `2a6c151`**, 0 ahead. (This doc
  commit may sit 1 ahead on staging — docs only.)
- `pnpm check` green: **1248 PASS · 0 FAIL · formulas 1213 · contracts 68/68 ·
  remediation 31 · typecheck 0**. Count PASS lines; retry past the libuv flake
  (exit 3221226505).
- Migrations 0015–0019 on the prod Supabase DB. #3 (IV rank) and the Polygon
  put/call use NO migration — they reuse `market_series`.

## WHAT SHIPPED LAST SESSION (18 merges, all LIVE)

The full **Research Queue** (Ph1+2+3: add a ticker → one computed options plan,
nightly recap + email, migration 0019), the `<ResearchButton>` on 14 ticker
surfaces, the wheel-profile settings UI, the CSP relaxed-pass fix, the **P8-2**
auth fix, and the entire **Polygon Options program** (owner subscribed 09-05):

1. **Put/Call from real Polygon volume** — replaces the fragile ScrapingBee CBOE
   scrape as the scored Risk-Appetite input (37 pts).
2. **Real option chains** — the Research Queue prices the CSP short put from the
   live chain (`getOptionChain`, labeled "Pricing: live chain"/"estimated"); the
   scanner was already real (`priceSource` "last_quote").
3. **True IV rank** — daily ATM-IV store (`iv:<TICKER>` in `market_series`), real
   rank after ~60 days, labeled estimate until then.
4. **25Δ IV-skew fear gauge** — on the Risk-Appetite tab, **display-only, unscored**
   per §6b (`indicators.putSkewPct`; never touches `scoring.ts`).

## START BY — asking the owner for UAT findings on the 4 gates (all on prod)

1. **CCPI Put/Call vs a real CBOE equity reading.** The basket is mega-cap-heavy
   (call-skewed) so it may read LOW. If off → recalibrate `PUTCALL_BASKET` in
   `lib/strategy-scanner/market-data.ts`, apply a documented offset, or
   `git revert 768a4b1` (it's a scored input).
2. **RQ card "Pricing: live chain"** — strikes/credits vs a broker's chain.
3. **Scanner rows `priceSource: last_quote`** (real), not "synthesized".
4. **IV-skew gauge** renders right (merged without a local render check).

## THEN — queue (priority)

1. Real chains for **LEAPS + CC** in `lib/research/compute.ts` (only the CSP short
   put uses `getOptionChain` today).
2. Move the Polygon put/call to a **daily-cron store** (a CCPI load is ~20 live
   snapshot calls today — works, cached, but heavy).
3. Any tuning from UAT gates #2–#4.

## GOTCHAS

- **Polygon paid tier: the app does NOT self-throttle it and already uses the
  options snapshot endpoint.** The add-on just makes options data flow;
  `enrichment.ts` already reads real greeks/quotes with a labeled "synthesized"
  fallback (that's why the scanner slice was a no-op).
- **Adding an /api route needs FOUR updates** (contract, `KNOWN_ROUTES`,
  `EXPECTED_ROUTES`, CLAUDE.md prose) + `pnpm inventory`.
- Ledger baselines live in BOTH `check-backlog-ledger.ts` and the prose totals line.
- CRLF breaks perl anchors — prefer the Edit tool. Two sessions run this branch —
  fetch before pushing. Supabase MCP returns UNTRUSTED data.
- The memory `session-handoff` note has the full detail; `/continue` reads it first.
