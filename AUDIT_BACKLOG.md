# AUDIT BACKLOG — Options-Calculators.com

> Working ledger for the audit charter in [AUDIT_PLAN.md](AUDIT_PLAN.md).
> Every phase **appends** findings here. Nothing gets deleted — findings move to
> §Closed with the commit that fixed them.

**Severity:**

| Sev | Meaning | Handling |
|---|---|---|
| **P0** | Wrong data rendered to a user as if it were correct | Fix immediately, same session |
| **P1** | Broken — feature does not work, or a stated capability does not exist | Fix in the phase that finds it |
| **P2** | Misleading — technically running but the user draws a wrong conclusion | Scheduled fix |
| **P3** | Debt — correctness unaffected, maintainability/cost affected | Backlog burn-down (Phase 7) |

**ID scheme:** `S-n` seeded from AUDIT_PLAN §6 · `P1-n` found in Phase 1 · `P2-n` found in Phase 2 · etc.

**Status:** `open` · `fixed` (commit noted) · `wontfix` (rationale noted) · `verified-ok` (investigated, not a defect).

> **Every status lives in the §STATUS LEDGER below, and nowhere else.** The finding
> rows carry the narrative; they do not carry the verdict. Adding a second place to
> record closure is what produced P6-66, where two rows for one finding disagreed.
> `scripts/check-backlog-ledger.ts` fails the suite if a finding exists without a
> ledger row, or a ledger row without a finding.
---

## PHASE 6 SYNTHESIS — how this codebase fails

> Written 2026-08-11 after fifty-one findings landed in one day (P6-38…P6-88).
> **Read this instead of the rows.** The rows record what was wrong; this records
> what kept going wrong, which is the part that transfers to Phase 7.

### The five shapes

Every finding this phase is one of five, and naming them is worth more than the
list, because each has a different tell:

1. **A label naming a provenance the code does not have.** "AI Insights" over a
   string literal; CME FedWatch over a rule-based tally; "SOURCE: Weekly AAII
   survey" over a number derived from VIX. **Three separate tabs borrowed an
   institution's name because the OUTPUT resembled that institution's output.
   Nobody checked the input in any of the three.**
2. **Invented data served as measured.** Fabricated Form 4 filings naming real
   people; synthesized option premiums sorted alongside real quotes; three trade
   setups returned at HTTP 200 under a comment admitting they were defaults.
3. **A missing value rendered as neutral or reassuring.** Neutral-50 on a fear
   scale; a `$0.00` price target; a proximity bar defaulting to the end its own
   legend labels "Safe". **This one appears at every layer** — route, response
   and component — and the component side had never been swept at all.
4. **A composite counting one input twice.** `aaii = investorIntelligence × 0.9`,
   both scored; NYSE highs/lows synthesized from the SPY momentum that is
   already indicator 1; price stability that was beta restated.
5. **A control that accepts input and does nothing.** Five Refresh buttons, two
   sliders bound to withheld values.

### What actually causes them

- **Every composite defect arose from a fallback, never from a decision to
  double-count.** A source could not supply a number, someone derived it from a
  number they had, gave it the missing thing's name, and the average then treated
  the derivation as evidence. **A proxy is a labelling problem right up until it
  enters an average, at which point it becomes an arithmetic one.**
- **A decision enforced in one module is not enforced.** P6-34 stopped AI
  estimates scoring — in `unified-ai-fallback.ts`. The identical pattern sat in
  `grok-market-data.ts` untouched, and two scrapers self-reported `status:
  "live"` for LLM answers, walking around the decision entirely on a 55-point
  input. The same shape appeared with a default encryption key that two hardening
  passes had routed *around* rather than removed.
- **Dead code is where defects wait.** Three of this phase's P1s were dormant:
  a second Fear & Greed implementation counting VIX three times, AI helpers
  ending `return value || 30`, a hardcoded credential. **Dead code makes no
  claims, so no check can see it.**
- **The record drifts as readily as the code.** An erased sign-off ledger, two
  contradicting rows for one finding, a breadth trough dated from expectation
  rather than a query, a plan document 40% wrong on its own inventory, and a
  generator that silently dropped the flagship tab. **A document is a claim until
  something recomputes it.**

### What finds them

In rough order of yield this phase:

1. **Following a label to the code behind it.** Found P6-42, P6-45, P6-58 and
   P6-72. The prose is a pointer, not the defect — the fabrication is usually a
   layer down.
2. **Asking of each pair in a composite: can A ever disagree with B?** If
   `B = f(A)` and f is monotonic, B carries no information. Four composites
   failed this; two passed.
3. **Writing an assertion for something untested.** Four times this phase the
   test found a defect rather than confirming its absence — an untested live
   function, an accuracy claim half an order of magnitude optimistic, and a
   blank env var that set the spend hard-stop to $0.
4. **Comparing two numbers that should agree.** A doc sweep noticing "41 tabs"
   where it had read 42 is what exposed the dropped ledger row.

### What does not find them

- **Grep sweeps for `|| <const>`.** They found the early phase-6 defects and
  **missed every single one from this phase**: the numbers were fine, the nouns
  were false, and the constants that remained were `let x = 150` assignments the
  pattern never matched.
- **Reading code for correctness.** P6-21 established it and this phase
  confirmed it: a sign convention, a boundary or a redundancy is not reviewable
  by reading. It needs a test with real numbers in it.
- **The checks alone.** Thirteen provenance rules now exist and **P6-81 would
  pass all of them.**

### The checks, and what they deliberately do not cover

`scripts/check-provenance.ts` (13 rules), `ccpi-certainty-ceiling.ts`,
`check-ops-guards.ts` and `site-inventory.ts --check` are a ratchet against
regression, not a proof of correctness. Their blind spots are listed in
*"What check-provenance.ts cannot see"* below and should be read with them.
Two are worth repeating here:

- **A check that stops COVERING is as invisible as one that stops running.**
  Rule 13's scope was once a keyword scan; rewording a `console.log` removed the
  only token putting a file in scope, and the suite went on passing with the
  count silently down from 12 to 11. Scope must come from structure — imports,
  call sites — never from incidental prose, and any check deriving a file set
  should assert that set's size.
- **"We have a check for that" is the false assurance this audit exists to
  remove.** Where a check has a known gap, the gap is recorded beside it.

### Three modules cannot be tested at all

`lib/ccpi/calculations.ts` and `lib/ccpi/constants.ts` (extensionless relative
imports node's type-stripping cannot resolve), and `lib/budget-guard.ts` (imports
Supabase-touching modules). The first two need one character per import plus a
`next build` to confirm; the third needs a small extraction. **This constraint
silently decides what can be verified**, which is a strange thing for a project
with 492 assertions to leave undecided. One decision, next session.

---

## STATUS LEDGER — the machine-readable open/closed record

> Written 2026-08-11 as Phase 7.1. **Before this section existed, no programmatic
> pass over this file could tell open from closed.** Closure was recorded in
> fourteen different ways — `FIXED`, `CLOSED`, `DONE`, `RETIRED`, `DELETED`,
> `BUILT`, `COMPLETE`, `SUPERSEDED`, `CLOSED-WONTFIX`, `PART-FIXED`, membership of
> the §Closed section, a sentence in a Verification cell, a summary line elsewhere
> in the file, or nothing at all — while the header at the top of this file has
> defined exactly four statuses since Phase 0 and **not one row used them**.
>
> This table is the single place a status lives. The finding rows below keep the
> narrative; they no longer carry the verdict.

**Vocabulary** — the four the header defines, and nothing else:
`open` · `fixed` · `wontfix` · `verified-ok`.

**How each status was assigned**, so the assignment can be audited rather than trusted:

- `fixed` — a row records the change, with no "REMAINING" / "still open" /
  "NOT FIXED" qualifier attached to it.
- `wontfix` — closed on a stated rationale rather than a change.
- `verified-ok` — investigated and found not to be a defect.
- `open` — **everything else, including every partial fix.** Under-claiming closure
  is deliberate: a false `fixed` sends Phase 7.4 past a live defect, a false `open`
  costs one re-read.

**What the check enforces, and what it cannot.** `scripts/check-backlog-ledger.ts`
recomputes the ID set from the finding tables and asserts this ledger covers it
exactly, that every status is one of the four words, that no ID is listed twice, and
that the row count matches an asserted baseline (P6-75, P6-77 — a check that stops
covering is as invisible as one that stops running). **It cannot verify that a status
is true.** `fixed` here means the record says so, not that anyone re-read the code
today. Twelve rows were re-checked against the tree while writing this and are marked
`(verified 2026-08-11)`; the rest are the record's own claim. Phase 7.4 confirms
before acting, per the standing rule that a document is a claim until something
recomputes it.

| ID | Sev | Status | Note |
|---|---|---|---|
| S-1 | P0 | fixed | Real 9-period EMA signal line; `check-macd.ts`. |
| S-2 | P3 | fixed | Wilder RSI in `lib/indicators.ts`. |
| S-3 | P2 | fixed | `lib/fomc-schedule.ts` is the single source for Fed dates. |
| S-4 | P3 | wontfix | Finnhub's calendar was never adopted. The publication *rule* is the fact, so the rule-derived events stay and their invented figures were nulled instead. |
| S-5 | P3 | open | 21 → 10 TypeScript errors. The 10 are the standing baseline. |
| S-6 | P3 | fixed | wheel-scanner 4,439 → 386 lines. General module-size debt is P6-13, not this. |
| S-7 | P3 | open | Both `MEGA_CAP_STOCKS` tables deleted; `MAJOR_INDEX_TICKERS` fallback survives and is still unlabelled when it is the universe actually used (verified 2026-08-11). |
| S-8 | P2 | fixed | **Closed 2026-08-11.** Dead `maxPE` deleted with its "FIX: Declare maxPE state variable" comment. The two hidden gates are now stated on the Step 4 card — 1% minimum yield, 2M minimum volume — and the false comment calling `minVolumeTechnicals` unused is replaced. **Sliders remain unbuilt**; naming a gate the user cannot adjust is the honest half, not the whole fix. |
| S-9 | P2 | fixed | **Verified 2026-08-11**, which is what the row asked for. P6-43 satisfied it and nobody re-marked: both results tables mark every affected cell `est.`, each carries a title naming the fixed 35% IV assumption, and the header states how many of N rows have no live quote and warns that sorting by yield ranks them against real quotes. The estimate constants are cited, not merely flagged. |
| S-10 | P2 | fixed | **Closed 2026-08-11.** Now `S · σ · √T` off measured IV, computed in `enrichment.ts` where an IV exists, and withheld when the IV is synthesized. The `lib/black-scholes.ts` docstring had claimed this fix since Phase 1 while the call site kept the fudge. |
| S-11 | P3 | fixed | Owner dropped the pillar. The wider AAII footprint is P6-31, not this. |
| S-12 | P3 | fixed | `/api/market-breadth` retired; E-6a replaced it. |
| S-13 | P3 | open | Zero `REDDIT_CLIENT` references remain in code; the Vercel env deletion is Joel's and is outstanding. |
| S-14 | P3 | fixed | FMP screener path gated on plan detection with a named status. |
| S-15 | P2 | fixed | Closed by P6-26 — thin financials yield null, not 0. |
| S-16 | P3 | open | `scan-cache.ts` still removes only the key it just missed on; `v1`/`v2` keys persist (verified 2026-08-11). |
| S-17 | P3 | open | Redundant earnings-date extraction still at `fundamental-scan.ts:290` (verified 2026-08-11). |
| S-18 | P2 | fixed | **CLOSED.** Every step label a user or log reader sees derives from components/scanner/steps.ts; the guard scope is derived, which exposed four unguarded files and a second drifting one. Comments verified by hand — a comment cannot interpolate a constant. |
| S-19 | P1 | fixed | `lib/metered-fetch.ts` — real per-call metering. |
| S-20 | P3 | fixed | Both TwelveData proxies retired. |
| P0-1 | P3 | open | 15 orphan routes → **6 remain**: `yahoo-proxy`, `apify-proxy`, `google-trends`, `serper-finance`, `macro-indicators`, `scraping-bee/diagnostics` (verified 2026-08-11). Each still needs a keep-or-delete verdict. |
| P0-2 | P1 | fixed | Breadth route and lib deleted. |
| P0-3 | P3 | fixed | `/api/qqq-technicals` route gone, `lib/qqq-technicals.ts` kept (verified 2026-08-11). |
| P0-4 | P2 | fixed | **Re-measured 2026-08-11 and the row was wrong: 9 of 35 outbound routes unwired, not 40 of 61.** `lib/fetch-timeout.ts` built, all 9 wired, `check-route-timeouts.ts` keeps it at zero. |
| P0-5 | P2 | fixed | Alias resolution through `resolveApiKey`; last holdouts closed by P6-12. |
| P0-6 | P3 | open | Payoff math per strategy for the 8 shared LEARN tabs — partly covered by P3-25/26/27, never signed off as a set. |
| P0-7 | P3 | wontfix | The inventory is regex-based by design. Recorded as a limitation rather than trusted as exhaustive. |
| P1-1 | P0 | fixed | Real `implied_volatility` from the options snapshot; `ivRank` deleted. |
| P1-2 | P0 | fixed | `Math.random()` removed from `/api/strategy-scanner`. |
| P1-3 | P0 | fixed | As P1-2. |
| P1-4 | P0 | fixed | As P1-2. |
| P1-5 | P0 | fixed | As P1-2. |
| P1-6 | P0 | fixed | As P1-2. |
| P1-7 | P0 | fixed | `priceCreditSpread` — both legs Black-Scholes at measured IV. |
| P1-8 | P0 | fixed | `optionDelta` via N(d₁); the 50–95 clamp removed. |
| P1-9 | P2 | fixed | Fallback price tables and the `\|\| 100` default deleted. |
| P1-10 | P1 | fixed | `components/pricing-provenance.tsx` replaces the tab-level badge. |
| P1-11 | P1 | fixed | Route and lib deleted. |
| P1-12 | P2 | fixed | Keys resolve through `resolveApiKey`. |
| P1-13 | P3 | fixed | **Verified 2026-08-11**, which is what the row asked for. Two of the four constants were deleted by P3-19; the survivors are per-series tiered (P6-6), baseline-excluded (P3-12), and the dashboard renders per-pillar provenance. Surfaced P7-10 on the way. |
| P1-14 | P3 | fixed | **Closed 2026-08-11.** The ~40 commented-out `Math.random()` lines and the header claiming "we generate realistic mock historical data" are gone; the file now says why the history is empty. A comment is a claim about the code, and that one described an honest empty response as a mock generator waiting to be switched on. |
| P2-1 | P1 | fixed | The three routes return 502 on upstream failure. |
| P2-2 | P2 | fixed | **Route deleted 2026-08-11**, with three writers and one reader. It cost a self-fetch per request to write a module-level variable the next isolate could not read. Routes 61 → 60. |
| P2-3 | P3 | open | Triage done, verdicts partly executed — see P0-1 for what survives. |
| P2-4 | P2 | fixed | **Closed 2026-08-11 for the LLM group.** All five routes skipped for model cost are contract-tested via `lib/dry-run.ts`; skipped contracts 16 → 10. The ten left are store writes, auth side effects, fan-outs and metered scraping quota — a different problem, recorded separately. |
| P2-5 | P3 | fixed | `scripts/check-contract-coverage.ts` fails the build on drift and runs in `check:contracts`. |
| P2-6 | P3 | wontfix | Local TLS interception, not a repo defect. Recorded so it is not re-diagnosed. |
| P3-1 | P0 | fixed | CCPI reads real FRED spot VIX. |
| P3-2 | P0 | fixed | Insider values use `change`, never `share`. |
| P3-3 | P0 | fixed | As P3-2. |
| P3-4 | P0 | fixed | trend-analysis fetch window 180 → 320 days. |
| P3-10 | P1 | fixed | Pillar maxima sum to 100. |
| P3-11 | P1 | fixed | Crypto F&G replaced with CNN's equity index. |
| P3-12 | P1 | fixed | Baseline exclusion + renormalisation. |
| P3-13 | P1 | fixed | Certainty is data-quality only; playbook branches on regime; yield curve scored once. |
| P3-14 | P1 | fixed | Real VIX3M/VIX ratio from FRED VXVCLS. |
| P3-15 | P1 | fixed | **Confirmed 2026-08-11**, the re-mark 7.1 called for. `ai-estimate` has not scored since P6-34, and the `> 0` acceptance filter was replaced by per-metric plausibility windows. The only surviving `> 0` in the file parses an env-var TTL. |
| P3-16 | P1 | open | Panic/Euphoria. Partly closed by P6-8, P6-14, P6-61, P6-62. **Its open remainder is P6-8's open remainder — the same item under two IDs.** Work P6-8; this row closes with it. Needs an owner rebuild-or-retire decision, not code. |
| P3-17 | P1 | fixed | **Confirmed and closed 2026-08-11.** FedWatch (P6-45) and `^FVX`/sign (P6-17, P6-21) were already closed. The decay factor **was** still `1.0 - i * 0.15` unclamped — negative from the eighth meeting on, which sign-flips the expected change and walks the implied path backwards. Latent rather than live: the schedule holds about five future meetings today, and it becomes live the first time someone extends it a year. Clamped at zero. Schedule exhaustion was already handled. |
| P3-18 | P1 | fixed | **Confirmed LIVE and closed 2026-08-11 — the re-mark found two fabrications still shipping.** (a) `lastMonthChange = finalScore - weekAgoScore * 1.2` and `lastYearChange = ... * 2`: the week-ago score times an arbitrary constant, published as the month-ago and year-ago readings. (b) The scrape path set all four historical points to today's score under the caption "Extract historical data points", so every change computed to exactly 0.0 and `trend` reported "neutral" on every request. Both null now. **They survived every visual sweep because none of the four is rendered** — they reached the UI only through a cache-validity gate that REQUIRED them to be numbers, which is what made the fabrication load-bearing. |
| P3-19 | P1 | fixed | Unsourced indicators deleted from the scoring set. |
| P3-24 | P2 | fixed | SMA short-series no longer returns 0; the IPO false golden cross is gone. |
| P3-25 | P2 | fixed | Planner "% of stock price" 100× fix. |
| P3-26 | P2 | fixed | learn-pmcc worked example. |
| P3-27 | P2 | fixed | Iron condors render all four legs. |
| P4-1 | P3 | open | `components/wheel-strategy-planner.tsx` is dead UI with correct math. Wire it to a LEARN tab or delete it — still undecided. |
| P4-2 | P1 | fixed | Reset endpoint returns 501 with the real recovery procedure. |
| P4-3 | P1 | fixed | Rate limiting + constant-time comparison + `ADMIN_PASSWORD_HASH`. |
| P4-4 | — | open | Admin-managed API keys. Design agreed, unblocked by P4-3, not built. |
| P5-1 | P1 | open | Legacy Full Audit retired (A-1…A-3), but the second half — Phase-6-style sign-off of **every** admin tab — has not happened. **This is Phase 7.2.** |
| A-1 | P0 | fixed | `full-system-audit` route and component retired (verified 2026-08-11). |
| A-2 | P0 | fixed | Died with A-1. |
| A-3 | P0 | fixed | Died with A-1. |
| A-4 | P0 | fixed | `/api/admin/audit` retired (verified 2026-08-11). |
| A-5 | P0 | fixed | `data-source-status` rebuilt from `ccpi.provenance`; auth added. |
| A-6 | P0 | fixed | `remaining-site-status` retired (verified 2026-08-11). |
| A-7 | P0 | fixed | AI tab generated from `providerConfigs`. |
| A-8 | P0 | fixed | CCPI admin tab null-guarded. |
| A-9 | P1 | fixed | The three unauthenticated routes gated or retired. |
| A-10 | P1 | fixed | `/api/admin/restore` and its zip-slip write primitive deleted (verified 2026-08-11). |
| A-11 | P1 | fixed | APIs tab rebuilt over the api-keys helpers. |
| A-12 | P2 | fixed | Ads tab. |
| A-13 | P2 | fixed | Dead `usageCount` removed. |
| A-14 | P2 | fixed | Backup-tab copy corrected. |
| A-15 | P3 | fixed | Alpha Vantage copy corrected. |
| E-1 | — | open | Excel export. Needs the one `CriteriaCodes` spec answer. |
| E-2 | — | open | "Ask AI" popover. Needs a planning session — cost, trigger design, verdict liability, grounding. |
| E-3 | — | open | POP column. Buildable now; needs the strike-vs-breakeven decision. |
| E-4 | — | open | Yahoo advanced-chart link. Needs the (a)/(b)/(c) decision. |
| E-5 | — | fixed | Budget guard built. Deploy prereqs listed on the row. |
| E-5a | P1 | fixed | `recordAiCall()` — the ledger now sees the pay-per-use providers. |
| E-5b | P1 | fixed | Five direct-provider libs routed through `resolveApiKey`. |
| E-5c | P1 | fixed | `maxOutputTokens` rename — the unbounded-output spend leak. |
| E-6 | — | open | Market Warning Score assessment. Verdict recorded; the sub-items below are the work. |
| E-6a | — | fixed | Breadth — % of stocks above the 200-DMA — built on `market_closes` + `compute_breadth`. |
| E-6b | — | open | IWM/SPY small-cap relative strength. |
| E-6c | — | open | Correlation & Diversification Checker tab. |
| E-6d | — | open | StockTwits attention velocity. |
| E-7 | — | open | Historical-data store umbrella. Sub-items below. |
| E-7a | — | open | `ai_estimates` cache table. Note P6-34 changed the value of this: AI estimates no longer score, so the spend it saves is smaller than when it was proposed. |
| E-7b | — | fixed | `fred-snapshot` cron; 21 series store-first. |
| E-7c | — | fixed | Consolidated market-snapshot cron; trend-analysis off Yahoo behind migration 0009. |
| E-7d | — | open | ISR on the four slow-moving routes. One line each. |
| E-7e | — | fixed | Per-day historical breadth + the lead-time backtest harness. First real run answers `insufficient-history`, which is the correct answer. |
| E-8 | — | open | Serper + Quiver expansion umbrella. Sub-items below. |
| E-8a | — | fixed | Quiver off-exchange short volume replaced the VIX-proxy short-interest component. |
| E-8b | — | wontfix | `wallstreetbets` 403 on the paid plan — measured, not inferred. |
| E-8c | — | open | Gov-contracts / lobbying as COPY columns — superseded in practice by E-8g; confirm and close. |
| E-8d | — | open | Serper /news per ticker for the Landmine column. |
| E-8e | — | wontfix | `insiders` 403 on the paid plan. |
| E-8f | — | wontfix | `sec13f` / `sec13fchanges` 403 on the paid plan. |
| E-8g | — | fixed | `/api/federal-money` + the Federal Money Trail tab, display-only. |
| E-8h | — | open | Wikipedia page views. **404, not 403 — a name problem, not an entitlement problem.** Three endpoint spellings queued for the next authenticated probe. |
| E-8i | P3 | open | The licensed `DPI` column in `offexchange` that nothing reads. Probe depth first; then it faces the E-6 lead-time gate like everything else. |
| P6-1 | P1 | fixed | Quiver plan purchased; all four routes answer 200 with real rows. |
| P6-2 | P3 | fixed | `/api/fmp-proxy` retired (verified 2026-08-11). |
| P6-3 | P2 | fixed | Health-check canary sends `skipAI=true`; 20.7s → 1.26s. |
| P6-4 | P0 | fixed | Invented AAII numbers removed from the CCPI dashboard. |
| P6-5 | P2 | fixed | Dead "AI Structural" constants deleted. |
| P6-6 | P0 | fixed | FRED observations parse to null; per-series tier map. |
| P6-7 | P2 | fixed | The LLM call for a value nothing consumed. |
| P6-8 | P1 | open | **Partial.** Commodities/gas/FINRA fixed. **Remaining:** short interest, margin debt, Investor Intelligence, AAII and "putCallRatio" are still VIX-derived proxies. Real sources or removal is a rebuild decision for Joel. |
| P6-9 | P2 | fixed | panic-euphoria SMA throws rather than returning a non-average. |
| P6-10 | P2 | fixed | `100 - x \|\| 50` precedence bug. |
| P6-11 | P1 | open | **Partial.** The hallucination pipeline is labelled and routed through the guarded chain. **Open decision:** rebuild the sentiment heatmap on real sources or retire the tab. |
| P6-12 | P1 | fixed | 25+ raw `process.env` key reads routed through `resolveApiKey`. |
| P6-13 | P3 | open | Module-size debt: 19 modules over 600 lines. Also the duplicated Black-Scholes in `greeks-calculator`. |
| P6-14 | P1 | fixed | MMF component normalised against its own history. |
| P6-15 | P2 | fixed | social-sentiment error banner; decorative 47/54/50 constants removed. |
| P6-16 | P0 | fixed | `/api/fomc-predictions` nullable end to end; 503 rather than a forecast on a stand-in rate. |
| P6-17 | P2 | fixed | `DGS2`/`DGS10` from FRED; `^FVX` gone. |
| P6-18 | P0 | fixed | CNN F&G invented component readings removed. |
| P6-19 | P1 | fixed | Both LLM prompts say "insufficient data" instead of 0/100. |
| P6-20 | P2 | fixed | All seven remaining sweep hits. |
| P6-21 | P1 | fixed | `lib/yield-curve.ts` owns the sign convention; 17 checks. |
| P6-22 | P2 | fixed | Two of three raw indicators now measured; `putCallRatio` named untrackable. |
| P6-23 | P1 | fixed | `pnpm inventory` reads the sign-off marks back; the 33 lost marks recovered. |
| P6-24 | P2 | fixed | Two static calculators no longer grade an empty form. |
| P6-25 | P1 | fixed | learn-csp and learn-leaps arithmetic; part (c) closed by P6-26. |
| P6-26 | P1 | fixed | TTM requires four reported quarters or is null. |
| P6-27 | P1 | open | **Partial.** `missingTickers[]` now surfaces a constituent going dark. **Still open:** why MMC dropped out, and whether its 188 stored rows should be repaired. Needs one live grouped call. |
| P6-28 | P2 | fixed | Health check reports which admin credential is in use. |
| P6-29 | P2 | fixed | The dead duplicate `components/ccpi/` directory deleted. |
| P6-30 | P2 | fixed | Social Sentiment no longer publishes 50/100 when every source is down. |
| P6-31 | P2 | open | **Partial.** (a) closed by P6-32. The rest of the AAII footprint outside the dropped pillar is still there — this row exists so it is not mistaken for closed. |
| P6-32 | P1 | fixed | The other 31 canary inputs guarded. |
| P6-33 | P3 | fixed | `SOX_REFERENCE_LEVEL` named, the sentence rewritten, drift between the two copies asserted. |
| P6-34 | P1 | fixed | AI estimates no longer carry scoring weight. |
| P6-35 | P2 | wontfix | **Superseded by `CCPI_DESIGN.md`, which is approved and shipped. Do not execute the rescale.** |
| P6-36 | P1 | fixed | Breadth no longer counts SPY and QQQ as constituents. |
| P6-37 | P2 | fixed | Four silent truncation caps; the half P6-69 found was completed there. |
| P6-38 | P2 | fixed | Five handler-less Refresh buttons (the fifth via P6-50). |
| P6-39 | P2 | fixed | `exit-rules` "AI Insights" over a string literal. |
| P6-40 | P3 | fixed | learn-leaps leverage range vs its own example. |
| P6-41 | P3 | fixed | Static tabs can now complete the sign-off ledger. |
| P6-42 | P1 | fixed | **Shipped to production 2026-08-11 in the third merge (`21be470`).** Fabricated trades attributed to named real people, deleted. Source was P6-52. |
| P6-43 | P1 | fixed | Synthesized option premiums now labelled, not sorted alongside quotes unmarked. |
| P6-44 | P2 | fixed | "pre-qualified for active options markets" removed. |
| P6-45 | P1 | fixed | CME FedWatch name removed from a heuristic that reads no futures. |
| P6-46 | P2 | fixed | "AI Trade Ideas & Adjustments This Week" across nine tabs. |
| P6-47 | P2 | fixed | CCPI options strategies removed per the owner's decision. |
| P6-48 | P3 | fixed | Two deterministic forecasters relabelled. |
| P6-49 | P2 | fixed | `scripts/check-provenance.ts` created. |
| P6-50 | P2 | fixed | Three more false AI labels. |
| P6-51 | P1 | fixed | Homepage "AI-powered crash probability model". |
| P6-52 | P1 | fixed | **Shipped to production 2026-08-11 in the third merge (`21be470`).** Seven invented Form 4 filings at HTTP 200 — the source of P6-42. |
| P6-53 | P1 | fixed | `/api/strategy-scanner` POST returned three invented setups. |
| P6-54 | P2 | fixed | Two dead sliders over a "not measured" column. |
| P6-55 | P3 | fixed | check-provenance extended from nouns to numbers. |
| P6-56 | P1 | fixed | Nine routes returning failure at HTTP 200. |
| P6-57 | P3 | fixed | Rule 9 and the three false starts, recorded. |
| P6-58 | P1 | fixed | Fear & Greed substitute invented two of seven components. |
| P6-59 | P2 | fixed | Closed later the same day — and reading the file back is what surfaced P6-81. |
| P6-60 | P2 | fixed | Rule 10 — pinned-claim registry. |
| P6-61 | P1 | fixed | Panic/Euphoria double-counted VIX. |
| P6-62 | P1 | fixed | Two tooltips naming real surveys as the source of VIX-derived numbers. |
| P6-63 | P2 | fixed | Registry grown to eight claims, walked from recorded owner decisions. |
| P6-64 | P3 | fixed | Process gotcha recorded: `git checkout --` discarded uncommitted work. |
| P6-65 | P2 | **open — Joel** | Social Sentiment fetched the identical Finnhub URL twice. The honesty is fixed; **the weight decision is the owner's: should 0.19 of the composite rest on one Finnhub corpus?** |
| P6-66 | P3 | fixed | Momentum strength nullable end to end. The row's original "LOGGED, NOT FIXED" text is superseded by the later row. |
| P6-67 | P3 | fixed | Composite independence audit — four defective, two clean. |
| P6-68 | P1 | fixed | Component-side neutral defaults, including the `$0.00` price target. |
| P6-69 | P2 | fixed | P6-37's half-applied fix completed. |
| P6-70 | P2 | fixed | P6-36 verified live; its recorded evidence corrected. |
| P6-71 | P1 | fixed | All 95 components swept; rule 12 keeps it swept. |
| P6-72 | P1 | fixed | `lib/grok-market-data.ts` bypass of P6-34. |
| P6-73 | P2 | fixed | The sign-off ledger states which lenses a tick was granted under. |
| P6-74 | P1 | fixed | `scrapeAAIISentiment` self-reporting `status: "live"` for an LLM answer. |
| P6-75 | P1 | fixed | A check silently stopped covering a file and reported PASS. |
| P6-76 | P2 | fixed | Certainty ceilings recomputed — 81 and 62 were correct all along. |
| P6-77 | P2 | fixed | The other twelve check scripts audited for P6-75's scope defect. |
| P6-78 | P1 | fixed | `pnpm inventory` silently dropped the flagship tab. |
| P6-79 | P2 | fixed | AUDIT_PLAN's inventory totals were ~40% wrong. |
| P6-80 | P2 | fixed | `site-inventory.ts --check`. |
| P6-81 | P1 | fixed | Dead second Fear & Greed implementation counting one instrument three times. |
| P6-82 | P2 | fixed | Dead-code sweep; four unreferenced exports deleted. |
| P6-83 | P3 | fixed | The generator check earned itself on first live use. |
| P6-84 | P2 | fixed | `normalCDF` accuracy measured against its own citation. |
| P6-85 | P2 | open | `lib/ccpi/calculations.ts` and `lib/ccpi/constants.ts` cannot be loaded by any check script. Needs `.ts` on two relative imports plus a `next build` to confirm the bundler accepts it. **This is Phase 7.0.** |
| P6-86 | P1 | fixed | A blank env var set the spend hard-stop to $0. |
| P6-87 | P3 | open | `lib/budget-guard.ts` is unassertable for the same reason. Needs `readBudget` extracted into an import-free module. **This is Phase 7.0.** |
| P6-88 | P1 | fixed | Default encryption key deleted from `lib/api-keys.ts`. |
| P6-89 | P1 | fixed | A commit broke `check:formulas` on staging and the suite went on looking green. Pure maths moved to the import-free `lib/vix-term.ts`. Numbered during 7.1 — it had been recorded as an unnumbered row. |
| P7-1 | P2 | fixed | The Costs tab's budget verdict excluded pay-per-use spend and called one of two budgets "the budget". |
| P7-2 | P2 | fixed | `totalIndicators \|\| 29` ×5 in the CCPI dashboard, plus a `?? 0` that defeated two routes' derived fallbacks. |
| P7-3 | P2 | fixed | Rule 12 could not see an integer default. Widened; it found eleven sites (P7-6). |
| P7-4 | P2 | fixed | Dead `validateCCPICalculation` returned "valid" for a composite it could not compute. Deleted. |
| P7-5 | P2 | fixed | `check-provenance.ts` printed the wrong line number for any file with a block comment above the hit. |
| P7-6 | P1 | fixed | Eleven defaulted-number sites across six public tabs, including a "Support" reference line drawn at y = 0 on a price chart. |
| P7-7 | P2 | open | **`next build` does not run on this machine, by either bundler — a second blocker on Phase 7.0.** Needs a Vercel preview deploy or a local Node downgrade. |
| P7-8 | P2 | fixed | The dead-code lens is now a rule (`check-dead-exports.ts`, ratcheted at 51). Its first run cleared itself because the allowlist named its own findings. |
| P7-9 | P3 | fixed | **17 → 0, decided one at a time.** Fourteen deleted, two wired to the caller that had reimplemented them, one un-exported. `KNOWN_DEAD` is now empty, so any new unreferenced export in `lib/` fails. |
| P7-10 | P2 | fixed | The 50 came from `fetchAlphaVantageIndicators`'s baseline object, not the `??` the row named, so the call-site guard never fired. Display rendered "$X \| 50/100" with Alpha Vantage down. |
| P7-11 | P2 | fixed | `check-dead-exports.ts` counted a same-named local declaration as a reference, so a lib export with a diverged twin — the dangerous case — read as live. |
| P7-12 | P2 | fixed | The Greeks calculator's own Black-Scholes is gone; gamma/theta/rho added to `lib/black-scholes.ts` with 19 new tests. The real bug was a missing `else` leaving stale Greeks on screen, not the NaN first recorded. |
| P7-13 | P3 | fixed | `expectedMove` recomputed inline in `/api/strategy-scanner` now calls `lib/black-scholes.ts` and skips the row when it returns null. |
| P7-14 | P2 | fixed | The unreachable hook is deleted, with its cascade: two whole modules, two aliases and a second composite implementation. `lib/` 230 → 224 exports. The rule's one-hop limit is recorded, not half-fixed. |
| P7-16 | P2 | fixed | The header now dates every reading, marks a cached one as cached, and flags it stale past the shared threshold. The date line had been wired to a field /api/ccpi never returns. |
| P7-17 | P1 | fixed | Thirteen more assembly-layer defaults on displayed CCPI inputs, plus twelve render sites calling .toFixed() on a nullable value behind a !== undefined guard — a TypeError, armed by P6-34. |
| P7-18 | P1 | fixed | The four QQQ pairs defaulted to false/0, and smaPoints(false, 0) returns 0 risk points — the score a calm market earns. An unavailable QQQ counted 41 of the momentum pillar as a measured all-clear. |
| P7-19 | P2 | fixed | check-null-guards.ts added: no formatter may be guarded only by !== undefined, the idiom behind P7-17. The four sites it found were conformance, not crashes. |
| P7-20 | P1 | fixed | /api/ccpi/executive-summary narrated an unscoreable composite to the model as "CCPI Score: 0/100" under its own "0-19: Low Risk" legend. Three layers produced the zero. |
| P7-21 | P2 | open | Two of four groups fixed (trend-analysis price, polygon-tickers filter zeros). Still open: sentiment-heatmap 50/50 (blocked on P6-11) and strategy-scanner static betas — both need a decision, not code. |
| P7-22 | P2 | fixed | Phase 7.5 standing guard: check-doc-figures.ts. CLAUDE.md carried "formulas 514" against a suite at 581 — the stale figure was inside the rule about staleness. |
| P7-23 | P2 | fixed | The P7-10/P7-17/P7-18 class had no standing guard — re-verification put tedSpread ?? 0.25 back and the whole suite passed. check-ccpi-defaults.ts closes it, negative-tested in all three forms. |
| P7-24 | P2 | fixed | check-house-libs.ts added — CLAUDE.md's "never re-implement locally" rule had no enforcement. Building it exposed a stripComments bug that hid ~70 lines of wheel-scanner.tsx from four checks. |
| P7-25 | P3 | fixed | Both classes are now rules. Building the prompt guard exposed two silent under-coverages in it — it reported 5 prompts where there are 11, covering none of the files it existed for. |
| P7-26 | P2 | fixed | **Original finding was half wrong.** The six "silent" scanners read a field P1-10 deleted; the real defect was three OTHER tabs that render it and labelled every fresh scan "Cached". market-sentiment dated. |
| P7-27 | P2 | fixed | Four components (1,548 lines) were imported by nothing and tree-shaken out of the production bundle — three of them the "public tabs" P7-26 was written about. check-dead-exports scopes to lib/, so nothing could see them. Owner chose retire: all four deleted, ratchet down to 2. |
| P7-28 | P2 | fixed | Fifteen components hand-built the Yahoo ticker URL in three spellings; only one normalised `.` to `-`, so class shares linked to a 404 from fourteen tabs. One library now owns it, pointing at the advanced chart per the owner's request, with a check. |
| P7-15 | P3 | wontfix | `daysBetween` is written three times because two of the modules must stay import-free to remain loadable by their check scripts. Collapsing it would cost test coverage. |

### The open list, by severity

231 findings recorded · **185 fixed · 8 wontfix · 0 verified-ok · 38 open.**
_(2026-08-11: Phase 7.2 added P7-1…P7-7 — six fixed, one open. The 7.4 confirmation
pass then closed P3-15, P3-17, P3-18, S-8 and P1-14. The ninth pass closed P7-9 and
P7-11 and opened P7-12 and P7-13 — the open count going UP is the check working: a rule
that finds nothing new is a rule that stopped looking.)_

`verified-ok` is empty on purpose. The vocabulary allows it and nothing currently
qualifies: every investigated-and-clean result on this project was recorded inside
another finding's row (P6-67's two clean composites, P6-77's twelve clean check
scripts) rather than as a finding of its own.

**P1 — 4.**
`P3-16` — Panic/Euphoria; the same open remainder as `P6-8`, under two IDs.
`P6-8` · `P6-11` — both need an owner rebuild-or-retire decision, not code.
`P6-27` — needs one live grouped Polygon call.

_(`P3-15`, `P3-17` and `P3-18` were confirmed and closed on 2026-08-11 — see below.
`P5-1` closed with Phase 7.2. The prediction that "three of the four are probably
already done" was **wrong on two of them**, which is the point of confirming.)_

**P2 — 6.**
`S-18` (the scanner's hidden gates, estimate badges, expected
move and step-number drift) · `P6-31` · `P6-65` **— Joel's weight decision** · `P6-85` **— Phase 7.0** ·
`P7-7` **— `next build` runs on neither bundler here; the second blocker on Phase 7.0** ·
`P7-10`.

**P3 — 11.**
`S-5` · `S-7` · `S-13` **— Joel's Vercel action** · `S-16` · `S-17` · `P0-1` · `P0-6` ·
`P2-3` · `P4-1` · `P6-13` · `P6-87` **— Phase 7.0** · `E-8i` · `P7-9`.

**Enhancements and unbuilt features — 16.**
`E-1` · `E-2` · `E-3` · `E-4` · `P4-4` · `E-6` (+ `E-6b`, `E-6c`, `E-6d`) ·
`E-7` (+ `E-7a`, `E-7d`) · `E-8` (+ `E-8c`, `E-8d`, `E-8h`).

**Closed on rationale rather than a change — 7.**
`S-4` · `P0-7` · `P2-6` · `E-8b` · `E-8e` · `E-8f` · `P6-35`.

**What this changes about "work the backlog by severity".** The real defect list is 24
items, not the 213 the file's length suggests — and half the P1s on it are bookkeeping,
not work. Nobody could see that before, which is the point of this section: closure was
recorded in fourteen vocabularies, and the file's own summary line was still calling
three items "remaining" (P6-29, S-11, S-14) that had each been fixed the day before.


---

## Seeded backlog (AUDIT_PLAN.md §6 + §2), file:line verified 2026-08-07

| ID | Sev | Tab / area | File:line | Finding | Fix |
|---|---|---|---|---|---|
| S-1 | **P0** ↑ | SCAN → Sell Put Scanner (Step 3 technicals) | [components/wheel-scanner.tsx:689](components/wheel-scanner.tsx:689) | `calculateMACD` sets `signal = macd * 0.9`. Because the comparison at [:1166](components/wheel-scanner.tsx:1166) is `macd.macd > macd.signal`, the test collapses to `sign(macd)` for every input: positive MACD is *always* "Bullish", negative *always* "Bearish". The "MACD Bullish" gate and column carry zero information beyond the MACD line's sign, yet are presented as a crossover signal. **Severity raised from the seeded P2 to P0** — this is wrong data rendered, not merely misleading. A correct implementation already exists in this repo at [app/api/trend-analysis/route.ts:155](app/api/trend-analysis/route.ts:155). | Replace with a real 9-period EMA of the MACD series (mirror the trend-analysis implementation); extract to `lib/indicators.ts` in Phase 4 so there is one copy. |
| S-2 | P3 | SCAN scanners, ANALYZE → Index Trend | [components/wheel-scanner.tsx](components/wheel-scanner.tsx), [app/api/trend-analysis/route.ts:135](app/api/trend-analysis/route.ts:135) | RSI uses a simple average of the last 14 changes rather than Wilder's smoothing. Deviation is small on trending series, larger right after a shock. | Implement Wilder's smoothing in `lib/indicators.ts`; unit-test against a published RSI-14 vector (Phase 3). |
| S-3 | P2 | SCAN → Sell Put Scanner (Landmine), ANALYZE → Earnings & Economic Calendar | [lib/economic-events.ts:75-90](lib/economic-events.ts:75) | FOMC events are emitted only for month 11 days 17–18 and month 0 days 28–29. The Fed meets 8×/yr, and the rule is year-agnostic, so it will keep firing those same day-of-month slots in every future year regardless of the real schedule. `forecast`/`previous` are the literal string `"TBD"` for every generated event. | Replace the curated rule with a real calendar source (see S-4) or a maintained dated list with an explicit expiry; never emit `"TBD"` as a value — omit the field and let the UI show "—". |
| S-4 | P3 | ANALYZE → Earnings & Economic Calendar | [lib/economic-events.ts](lib/economic-events.ts) | Finnhub's economic-calendar endpoint (already-paid-for key, [app/api/earnings-calendar/route.ts](app/api/earnings-calendar/route.ts) uses Finnhub) could replace the hand-rolled macro rules entirely. | Evaluate coverage/limits; if adequate, delete `generateCuratedEconomicEvents` rather than maintaining it. |
| S-5 | P3 | build/CI | — | ~21 pre-existing TypeScript errors (reported: 10 in wheel-scanner, 11 in polygon-proxy `Response.json` typing). Count to be re-measured in Phase 4. | Fix, then add `pnpm typecheck` to CI. |
| S-6 | P3 | SCAN → Sell Put Scanner | [components/wheel-scanner.tsx](components/wheel-scanner.tsx) (4,439 lines) | Monolith. See SITE_MAP.md §5 — 16 modules exceed the 600-line budget; `ccpi-dashboard.tsx` (3,363) is the second offender. | Phase 4 split into `components/scanner/*`. |
| S-7 | P3 | SCAN → Sell Put Scanner; polygon-tickers | **RE-LOCATED 2026-08-10** (Wave-2 split invalidated the old line numbers): [components/scanner/constants.ts:7](components/scanner/constants.ts:7) (`MEGA_CAP_STOCKS`), [:155](components/scanner/constants.ts:155) (`MEGA_CAP_STOCKS_ALPHABETIZED`), [app/api/polygon-tickers/route.ts:265](app/api/polygon-tickers/route.ts:265) (`MAJOR_INDEX_TICKERS`) | Three hardcoded ticker universes: `MEGA_CAP_STOCKS`, `MEGA_CAP_STOCKS_ALPHABETIZED`, and the `MAJOR_INDEX_TICKERS` fallback. | Confirm which are still reachable; delete the dead ones, and label the `MAJOR_INDEX_TICKERS` fallback in the UI when it is the source actually used. |
| S-8 | P2 | SCAN → Sell Put Scanner (Steps 3–4) | **RE-LOCATED 2026-08-10:** [components/scanner/use-wheel-scanner.ts:110-111](components/scanner/use-wheel-scanner.ts:110) (the two defaults, `useState([1])` / `useState([2])`), [components/scanner/technical-criteria.ts:37](components/scanner/technical-criteria.ts:37) and [:59](components/scanner/technical-criteria.ts:59) (`yieldCheck` / `volumeCheck`). **Still real, and the split made it plainer** — the source now carries the comment "This variable is declared but not used in the provided code snippet" beside `minVolumeTechnicals`, which is wrong: `technical-criteria.ts` filters on it. There is still no Step-4 slider for either. A post-scan `minYield` box does exist in [relaxed-results-table.tsx:178](components/scanner/relaxed-results-table.tsx:178), but that filters the table after the fact and is not the hidden gate | Hidden gates with no UI control: `minYield` defaults to 1 (%) and `minVolumeTechnicals` to 2 (M), and both filter results at `yieldCheck`/`volumeCheck`. `minVolume` (2M) at [:511](components/wheel-scanner.tsx:511) does have UI. `maxPE` at [:519](components/wheel-scanner.tsx:519) is declared and never read — dead state. | Expose `minYield`/`minVolumeTechnicals` as sliders or document them in the Step 3 explainer; delete `maxPE`. |
| S-9 | P2 | SCAN → Sell Put Scanner (Step 4, market closed) | **RE-LOCATED 2026-08-10:** [components/scanner/enrichment.ts:296](components/scanner/enrichment.ts:296) (`delta = -0.5 * Math.pow(moneyness, 3)`) and [:301](components/scanner/enrichment.ts:301) (`const estimatedIV = 0.35`), gated by `useEstimatedGreeks` set at [:217](components/scanner/enrichment.ts:217) | `delta = -0.5 * moneyness³` and `estimatedIV = 0.35` are invented constants used when live greeks are unavailable. Whether the user can tell these rows are estimates needs verification. | Verify the `useEstimatedGreeks` badge actually renders on every affected cell; if not, add it. Cite the constants' provenance in the tooltip or replace with IV-derived values. |
| S-10 | P2 | SCAN → Sell Put Scanner (Landmine expected move) | **RE-LOCATED 2026-08-10:** [components/scanner/fundamental-scan.ts:38](components/scanner/fundamental-scan.ts:38) | `expectedMove = price × (ATR% / 100) × √(days/7) × 1.5`. The `1.5` is a fudge factor with no reference. Real IV is now captured. | Replace with the standard IV-based expected move `price × IV × √(DTE/365)`; unit-test in Phase 3. |
| S-11 | P3 | ANALYZE → Social Sentiment | [app/api/social-sentiment/route.ts](app/api/social-sentiment/route.ts) (`www.aaii.com`) | AAII sentiment fetch is unreliable; component runs on a baseline. Needs a Nasdaq Data Link free key to be real. **PART-FIXED (staging) 2026-08-10.** The "runs on a baseline" half was already closed — the fetch returns `-1/unavailable` and is excluded from the weighted average. The half nobody had looked at was the parser: it ran two independent regexes over the whole page and paired whatever each matched first. `www.aaii.com/sentimentsurvey` is a chart script holding ~121 undated tooltip strings, so "first bullish" and "first bearish" came from different weeks; it failed closed only because the first tooltip happens to read 0.0%, which its range check rejected. Parsing moved to `lib/aaii-sentiment.ts`, which accepts a reading only as a co-located bullish/neutral/bearish triple summing to 100 (±1) **and** only when the page yields exactly one distinct such record — the tooltips carry no date, so with several on the page there is no way to know which week is this week, and guessing is how an undated number gets published as live. 19 checks in `scripts/check-aaii-sentiment.ts` (formulas suite 159 → 178) pin the real page's ordering. **CLOSED same day — owner chose to drop the pillar** rather than wire a Nasdaq Data Link key. `getAAIISentiment`, the indicator row, the loading line and `lib/aaii-sentiment.ts` + its 19-check script are gone; the Social Sentiment tab now has six sources, and because the composite divides by the weight of the LIVE sources, removing AAII's 0.12 renormalises the rest with no other weight change. A second, unimported copy of the same scrape in `lib/sentiment-sources.ts` — carrying the identical two-independent-regexes defect — went with it. Formulas suite back to 159 (the checks pinned code that no longer exists). **Note the wider AAII footprint is untouched and is NOT this item:** see P6-31. | Fixture cut from the live page, with the 0/0/0 and 50/0/50 placeholders and two real weeks in their real order — kept in the commit history, since the code it pinned is deleted. |
| S-12 | P3 | ANALYZE → CCPI | [lib/market-breadth.ts](lib/market-breadth.ts), [app/api/market-breadth/route.ts](app/api/market-breadth/route.ts) | NYSE breadth and ETF-flow pillars run on graceful baselines by design. | Revisit in Phase 3 when CCPI pillar weights are verified — confirm a baselined pillar is excluded from, not averaged into, the composite. |
| S-13 | P3 | ops | Vercel env | `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` unused since Reddit was removed. | Delete from Vercel env (manual — requires dashboard access). |
| S-14 | P3 | SCAN → polygon-tickers | [app/api/polygon-tickers/route.ts](app/api/polygon-tickers/route.ts) | FMP screener 403 path is dormant. **FIXED (staging) 2026-08-10 — gated on plan detection, which was the better of the two options offered.** The real problem was not that the path is dormant but that its dormancy was invisible: `/api/v3/stock-screener` is paid-tier, a free key gets 403, `fetchFMPScreener` returned a bare `null`, and the route silently served a different universe. Nothing told the caller whether it was looking at FMP's market-cap-ranked list or Polygon's grouped bars, and nothing told the audit whether the path was broken, unconfigured, or simply not in the plan. It now returns a named status — `ok` / `no-key` / `not-in-plan` (403) / `unauthorized` (401) / `http-error` / `bad-payload` / `network-error` / `skipped-latched` / `skipped-range-filter` — surfaced on every response as `universe.fmp`, on all three exits (FMP, grouped bars, hardcoded last resort). A 403 **latches for the process lifetime**, so a plan that has already refused is not billed a metered call on every scan; a plan upgrade takes effect on the next cold start rather than needing a code change. Same 403-vs-401-vs-404 discrimination that settled the Quiver datasets: 403 is an answer, not a fault. | `curl '/api/polygon-tickers?minMarketCap=2&minVolume=2&limit=5'` and read `universe.fmp.status`. Contract schema is `anyObject`, so the added field needs no contract change. |
| S-15 | P2 | SCAN → Sell Put Scanner (Step 2 fundamentals) | [components/wheel-scanner.tsx](components/wheel-scanner.tsx) | Newly-IPO'd tickers with thin financial history (e.g. SPCX) render `0%` ROE rather than "insufficient history" — a real zero and a missing value are displayed identically. | Distinguish `null` from `0` through the fundamentals pipeline; render "insufficient history". |
| S-16 | P3 | SCAN → Sell Put Scanner | **RE-LOCATED 2026-08-10:** [components/scanner/scan-cache.ts:4](components/scanner/scan-cache.ts:4) (`CACHE_VERSION = "v3"`), keys built at [:66](components/scanner/scan-cache.ts:66) as `fundamental_scan_v3_...`. Still real: `loadFromCache` removes only the key it just missed on, so `v1`/`v2` keys stay forever | localStorage keys from older cache versions are never evicted; they accumulate in the user's browser forever. See SITE_MAP.md §7 for the full key inventory. | On mount, sweep and drop keys matching the family prefix whose version segment ≠ current. |
| S-17 | P3 | SCAN → Sell Put Scanner | **RE-LOCATED 2026-08-10:** [components/scanner/fundamental-scan.ts:288-300](components/scanner/fundamental-scan.ts:288) — `snapshotData.ticker?.earnings_date \|\| ticker_data?.next_earnings_date \|\| snapshotData.results?.earnings?.date` | Earnings-date extraction from the Polygon snapshot is redundant now that the Landmine/Finnhub path supplies it. Still real; note the second producer at [:27](components/scanner/fundamental-scan.ts:27) in the same file. | Delete the redundant extraction. |
| S-18 | P2 | SCAN → Sell Put Scanner (copy) | **RE-LOCATED 2026-08-10:** spread across nine files after the split — 40 literal "Step N" strings, most in [scanner-notices.tsx](components/scanner/scanner-notices.tsx) (11), [wheel-scanner.tsx](components/wheel-scanner.tsx) (9) and the four `stepN-*-card.tsx` files | Step numbering drift — buttons, card headings and error strings disagree about which step is which. **The split made this worse, not better:** the numbers are now duplicated across nine files with no shared constant. | One source of truth for step numbers/labels; render everything from it. |
| S-19 | **P1** | ADMIN → Costs | [lib/api-costs.ts](lib/api-costs.ts), [app/api/admin/usage/route.ts](app/api/admin/usage/route.ts) | No real per-call API metering exists anywhere. The admin Costs tab presents estimates; the admin cannot answer "what did this site cost this month". A stated capability that does not exist. | Phase 5: `lib/metered-fetch.ts` → Supabase `api_calls` table → daily rollups. |
| S-20 | P3 | ops / routes | [app/api/twelve-data-proxy/route.ts](app/api/twelve-data-proxy/route.ts), [app/api/twelvedata-proxy/route.ts](app/api/twelvedata-proxy/route.ts) | Two routes for the same provider, neither with an in-repo consumer (SITE_MAP.md §3). One is `runtime="edge"`, the other Node. | Retire both if genuinely dead; otherwise keep exactly one. Covered by P2-* route triage below. |

---

## Phase 0 findings (inventory)

| ID | Sev | Tab / area | File:line | Finding | Fix |
|---|---|---|---|---|---|
| P0-1 | P3 | ops / routes | SITE_MAP.md §3 | **15 API routes have no in-repo consumer**: `/api/admin/ccpi-audit`, `/api/admin/restore`, `/api/apify-proxy`, `/api/fmp-proxy`, `/api/google-trends`, `/api/macro-indicators`, `/api/market-breadth`, `/api/qqq-technicals`, `/api/scraping-bee/{diagnostics,test,test-connection}`, `/api/serper-finance`, `/api/twelve-data-proxy`, `/api/twelvedata-proxy`, `/api/yahoo-proxy`. Each is deployed surface area, some holding API keys. | Per-route verdict in Phase 2: keep (with a documented external caller) or delete. |
| P0-2 | **P1** | ANALYZE → CCPI | [lib/market-breadth.ts](lib/market-breadth.ts), [app/api/market-breadth/route.ts](app/api/market-breadth/route.ts) | **NYSE breadth is dead code, not a CCPI pillar.** AUDIT_PLAN §1 and §2(12) both describe market breadth as a CCPI composite input running on a graceful baseline. It is not an input at all: `fetchMarketBreadth` is called only by `/api/market-breadth`, and that route has no caller anywhere in the repo. `grep -i breadth` over `app/api/ccpi/route.ts` and `lib/ccpi/` returns nothing. The documented "breadth pillar" does not exist in the running composite. | Decide: wire breadth into the CCPI composite, or delete `lib/market-breadth.ts` + the route and strike breadth from AUDIT_PLAN §1. Do not leave it looking wired. Supersedes S-12's breadth half. |
| P0-3 | P3 | ANALYZE → Index Trend Analysis | [app/api/qqq-technicals/route.ts](app/api/qqq-technicals/route.ts) | AUDIT_PLAN §1 lists `/api/qqq-technicals` as a primary API of the Index Trend Analysis tab. It is not: that tab calls `/api/trend-analysis` only. The route is a 23-line HTTP wrapper over `lib/qqq-technicals.ts`, and the **lib** is genuinely used — imported directly by [app/api/ccpi/route.ts:3](app/api/ccpi/route.ts:3). So the data is live, but the route wrapping it is dead. | Delete the unused route wrapper (the lib stays); correct AUDIT_PLAN §1's Index Trend row. |
| P0-4 | P2 | site-wide | SITE_MAP.md §2 | **40 of 61 routes have no timeout/abort wiring** on their outbound fetches. A hung upstream ties up the function until the platform limit. Notably `/api/strategy-scanner` — the single API behind 10 components including all 6 non-flagship scanners and the entire LEARN toolbox — has neither a timeout nor a `maxDuration`. | Phase 2: a shared `fetchWithTimeout` helper; enforce presence via the contract tests. |
| P0-5 | P2 | site-wide | SITE_MAP.md §2 | **Env-key aliasing is real and undocumented**: `TWELVEDATA_API_KEY` vs `TWELVE_DATA_API_KEY`, `GOOGLE_AI_API_KEY` vs `GOOGLE_GENERATIVE_AI_API_KEY`, `GROK_XAI_API_KEY` vs `XAI_API_KEY` are each read by different routes. A key set under one alias silently leaves the other route dead. | Resolve every key through `lib/api-keys.ts` alias resolution; assert in the health-check endpoint that each provider resolves to exactly one live key. |
| P0-6 | P3 | LEARN (16 tabs) | SITE_MAP.md §1 | 8 of the 16 LEARN tabs are the same `OptionsStrategyToolbox` component parameterised by a `strategy` prop; it calls `/api/strategy-scanner`. Payoff math and live data for 8 tabs therefore share one code path. | Phase 6 can sign off all 8 together, but the payoff-diagram math must be verified per strategy (Phase 3). |
| P0-7 | P3 | tooling | [scripts/site-inventory.ts](scripts/site-inventory.ts) | Inventory is regex-based, not AST-based: it resolves literal `"/api/..."` strings and `https://host` literals. Fully template-interpolated URLs (`` `${base}/x` ``) are missed. | Acceptable for the audit; note the limitation rather than trusting the map as exhaustive. |

**Corrections to AUDIT_PLAN.md §1 measured by the inventory:** 61 API routes (not 42), 62 components under `components/` excluding `ui/` (not 53), 41 public tabs (not 33). The 33 figure appears to predate the LEARN expansion.

---

## Phase 1 findings (data integrity)

### The headline: `/api/strategy-scanner` is a synthetic-data generator wearing live-data labels

One route backs **10 components** — the Calendar Spread, Credit Spread, Iron Condor, Butterfly,
LEAPS and ZEBRA scanner tabs, the High-IV Watchlist, the Earnings Plays scanner, the Wheel
Strategy Screener, and `OptionsStrategyToolbox`, which is itself 8 of the 16 LEARN tabs
(SITE_MAP.md §1–2). Its trade metrics are fabricated, and each tab renders a green
**"Live Data"** badge over them whenever the *stock price* fetch succeeded — regardless of
whether any other number on screen came from anywhere.

| ID | Sev | Tab / area | File:line | Finding | Fix |
|---|---|---|---|---|---|
| P1-1 | **P0** | all 6 non-flagship SCAN tabs + 8 LEARN tabs | [app/api/strategy-scanner/route.ts:87](app/api/strategy-scanner/route.ts:87) | **Implied volatility is derived from the number of contracts an endpoint returned.** `getIVData` calls Polygon's `/v3/reference/options/contracts` — a *metadata* endpoint carrying no volatility field — with `limit=5`, then computes `avgIV = 30 + contracts.length * 2`. `contracts.length` ∈ 0..5, so every "live" IV on the site is one of {30, 32, 34, 36, 38}, determined by how many contracts happened to match a strike/expiry filter. It is then returned with **`isLive: true`**. `ivRank` is `(avgIV/60)*100` — also not an IV rank, which by definition requires a 52-week IV history this route never fetches. This single value propagates into the credit, max-loss, probability, breakeven, IV-skew, quality-score and signal of every setup on six tabs. | Read real `implied_volatility` from `/v3/snapshot/options/{ticker}` — the endpoint [app/api/polygon-proxy/route.ts:59](app/api/polygon-proxy/route.ts:59) already uses correctly for the Sell Put Scanner. Return `null` when unavailable. Delete the `ivRank` formula outright: without IV history there is no honest IV rank. |
| P1-2 | **P0** | SCAN → Butterflies | [app/api/strategy-scanner/route.ts:874](app/api/strategy-scanner/route.ts:874), [:907](app/api/strategy-scanner/route.ts:907) | `probabilityOfProfit: 25 + Math.random() * 20` (and `55 + Math.random() * 15` for broken-wing) — **unguarded**, not a fallback. Rendered verbatim at [components/butterfly-scanner.tsx:284](components/butterfly-scanner.tsx:284) and used in the ranking score at [:95](components/butterfly-scanner.tsx:95), so the table's sort order is a dice roll that changes on every refresh. | Delete. A long butterfly's P(profit) is computable from IV via the lognormal terminal distribution once P1-1 supplies real IV; until then render "—". |
| P1-3 | **P0** | SCAN → Butterflies | [app/api/strategy-scanner/route.ts:871-872](app/api/strategy-scanner/route.ts:871), [:904-905](app/api/strategy-scanner/route.ts:904) | `ivRank: ivData?.ivRank \|\| 35 + Math.random() * 40` and `ivPercentile: … \|\| 40 + Math.random() * 35`. Rendered at [components/butterfly-scanner.tsx:276](components/butterfly-scanner.tsx:276) and used as a user filter at [:104](components/butterfly-scanner.tsx:104). Separately, `signal` reads `ivData?.ivRank` while `reason` prints a hardcoded `45` when it is missing — so the badge and the sentence beside it can contradict each other. | Delete both fabrications; `null` → "—", and exclude null from the filter rather than treating it as 0. |
| P1-4 | **P0** | SCAN → ZEBRA | [app/api/strategy-scanner/route.ts:1068-1069](app/api/strategy-scanner/route.ts:1068), [:1087](app/api/strategy-scanner/route.ts:1087) | `stockScore = 5 + Math.random() * 4`, `trend = Math.random() > 0.3 ? "bullish" : …`, `optionVolume = 5000 + Math.random() * 50000`. All three render; `stockScore` and `trend` together determine the headline `signal`. The tooltip at [components/zebra-scanner.tsx:307](components/zebra-scanner.tsx:307) tells the user the score measures *"revenue growth, earnings, balance sheet strength, analyst ratings"* and to *"look for 7+"* — a specific factual claim about a random number. `trend` is also a user-facing filter at [:100](components/zebra-scanner.tsx:100). | Delete all three metrics, their tooltips, the trend filter and the ranking term. Re-derive `signal` from what is actually known (leverage ratio, extrinsic paid) or drop it. |
| P1-5 | **P0** | SCAN → LEAPS | [app/api/strategy-scanner/route.ts:989](app/api/strategy-scanner/route.ts:989) | `delta = 0.75 + Math.random() * 0.15`. Rendered as a column, printed into the `reason` sentence, used in the ranking score at [components/leaps-scanner.tsx:100](components/leaps-scanner.tsx:100), and exposed as the `minDelta` filter at [:109](components/leaps-scanner.tsx:109) — so the user filters on noise. | Compute with Black-Scholes; [lib/black-scholes.ts](lib/black-scholes.ts) already exists (`calculatePutDelta`, `estimateImpliedVolatility`) and needs a call-delta sibling. Depends on P1-1 for a real IV input. |
| P1-6 | **P0** | SCAN → Calendar Spreads | [app/api/strategy-scanner/route.ts:705](app/api/strategy-scanner/route.ts:705) | `daysNoEarnings = Math.floor(Math.random() * 60) + 30`. Rendered at [components/calendar-spread-scanner.tsx:495](components/calendar-spread-scanner.tsx:495), and at [:497](components/calendar-spread-scanner.tsx:497) it drives a literal **"Safe" / "Watch out"** verdict on earnings risk — the one risk a calendar spread is most exposed to. The source comment says "simulate". | Delete. Real earnings dates are already reachable: this route holds `FINNHUB_API_KEY` and `getUpcomingEarnings()` at [:101](app/api/strategy-scanner/route.ts:101) already fetches them. |
| P1-7 | **P0** | SCAN → Credit Spreads, Iron Condors | [app/api/strategy-scanner/route.ts:179-205](app/api/strategy-scanner/route.ts:179) | `estimateCreditSpreadPremium` invents option premium as `width × (IV/100) × √(dte/365) × (1 − 2·otm%) × 0.3`. The `0.3` and the linear OTM haircut have no basis; the whole expression is fed the fabricated IV from P1-1. Its output *is* the displayed `credit`, `maxLoss`, `riskReward` and `probability`, and `probability` gates which setups appear at all ([:250](app/api/strategy-scanner/route.ts:250), [:336](app/api/strategy-scanner/route.ts:336)). `dataSource` is labelled `"polygon+calculated"` / `"polygon+finnhub"`. | Price from the real option chain (Polygon snapshot bid/ask), or price with Black-Scholes off real IV. Until then the tabs cannot show credits. |
| P1-8 | **P0** | SCAN → Credit Spreads, Iron Condors, LEAPS | [app/api/strategy-scanner/route.ts:161-176](app/api/strategy-scanner/route.ts:161) | `calculateDelta` is `0.5 + moneyness / (2 · IV · √t)` — a linear approximation, not N(d₁); it has no drift term and clips at ±1. Its output is rendered as "Delta" and converted to a **probability of profit** at [:198](app/api/strategy-scanner/route.ts:198) (`(1 − delta) × 100`), which is then clamped to 50–95 at [:203](app/api/strategy-scanner/route.ts:203) — so a computed probability below 50% is silently displayed as 50%. | Replace with Black-Scholes N(d₁) from [lib/black-scholes.ts](lib/black-scholes.ts); remove the clamp, or label it. Unit-test in Phase 3. |
| P1-9 | P2 | all strategy-scanner tabs | [app/api/strategy-scanner/route.ts:7-22](app/api/strategy-scanner/route.ts:7), [:595](app/api/strategy-scanner/route.ts:595) | Two hardcoded price tables (`FALLBACK_PRICES`, `CALENDAR_FALLBACK_PRICES`) with prices frozen at authoring time (SPY 595, NVDA 145, …), and **`\|\| 100` for any ticker not in the table** — a fabricated $100 stock price. These reach `isLive: false`, so the tab-level badge does flip to "Estimated Data", but strike selection, breakevens and every dollar figure are computed off a stale or invented price with no per-row indication of *how* stale. | Drop the tables and the `\|\| 100`; when the price fetch fails, omit the ticker rather than inventing one. Adds S-7 to the hardcoded-universe count (5 tables, not 3). |
| P1-10 | **P1** | all strategy-scanner tabs | [components/zebra-scanner.tsx:209](components/zebra-scanner.tsx:209), [butterfly-scanner.tsx:364](components/butterfly-scanner.tsx:364), [leaps-scanner.tsx:217](components/leaps-scanner.tsx:217), [calendar-spread-scanner.tsx:215](components/calendar-spread-scanner.tsx:215) | **The "Live Data" badge is scoped wrong.** It is one tab-level boolean sourced from `priceData?.isLive` — i.e. "the stock price fetch returned 200". Every other metric on the page (IV, greeks, probability, credit, score, trend) can be fabricated while the badge reads green. A per-tab boolean cannot describe a table whose columns have different provenance. | Move provenance to the field level: each metric carries its own source, and the UI renders live / estimated / unavailable per column. This is the DataLoadGate/label pattern AUDIT_PLAN §Phase 1 calls for. |
| P1-11 | **P1** | ANALYZE → CCPI (documented), ops | [app/api/market-breadth/route.ts:12-25](app/api/market-breadth/route.ts:12), [lib/market-breadth.ts:8](lib/market-breadth.ts:8) | Route is dead *and* broken. `fetchMarketBreadth` is self-documented as "Deprecated (replaced by VIX Term Structure)" and returns `{newHighs: 0, newLows: 0}` with **no `highLowIndex` field**. The route reads `result.highLowIndex` → `undefined`, publishes `value: undefined`, and since `undefined < 0.30` and `undefined > 0.60` are both false, ships a confident `threshold: "neutral"`. The catch block returns a hardcoded `value: 0.42` with **HTTP 200**, so a caller cannot distinguish success from failure. | Delete route + lib (nothing consumes them — P0-2) and strike breadth from AUDIT_PLAN §1. |
| P1-12 | P2 | site-wide | [app/api/strategy-scanner/route.ts:3-4](app/api/strategy-scanner/route.ts:3) | `/api/strategy-scanner` reads `process.env.POLYGON_API_KEY` / `FINNHUB_API_KEY` directly instead of going through `resolveApiKey()`, so it **ignores the `DISABLED_APIS` kill switch** and the alias resolution in [lib/api-keys.ts:45](lib/api-keys.ts:45). Flipping the kill switch will not stop this route from spending. | Route every key read through `resolveApiKey`. Audit the other 60 routes for the same bypass in Phase 2. |
| P1-13 | P3 | ANALYZE → CCPI | [app/api/ccpi/route.ts:388-431](app/api/ccpi/route.ts:388) | Literal baseline constants (`ltv: 0.12`, `spotVol: 0.22`, `yieldCurve: 0.25`, `tedSpread: 0.25`) substituted when Alpha Vantage / FRED are unavailable. Unlike the scanner tabs, CCPI **does** carry a per-pillar `{live, source: "baseline"}` status object ([:221-230](app/api/ccpi/route.ts:221)) — this is the good pattern. | Verify the dashboard actually surfaces the baseline flag for each of these four, then mark verified-ok. Classified (a) graceful + labeled pending that check. |
| P1-14 | P3 | ANALYZE → CCPI, Earnings Calendar | [app/api/ccpi/history/route.ts:41-62](app/api/ccpi/history/route.ts:41) | 22 lines of commented-out `Math.random()` history generation, with a live comment at [:5](app/api/ccpi/history/route.ts:5) still reading "we generate realistic mock historical data". The code is dead but the comment misdescribes the file. | Delete the commented block and correct the header comment. |

**Fallback classification (AUDIT_PLAN Phase 1 rubric).** Of the fallback paths reviewed:
**(a) graceful + labeled** — CCPI's per-pillar `dataSourceStatus`, the Sell Put Scanner's
`useEstimatedGreeks` path (pending the S-9 badge check), `apify-yahoo-finance`'s
`baseline-*` dataSource strings. **(b) silent fake** — everything in P1-1 through P1-9;
the `isLive` badge is present but describes the wrong thing (P1-10).
**(c) dead** — `lib/market-breadth.ts`, `/api/market-breadth`, `/api/qqq-technicals`,
the `ccpi/history` mock block, and the 15 orphan routes in P0-1.

---

## Enhancement requests

Feature work, not defects. Tracked here so the audit does not lose them.
All four requested 2026-08-07 against the Sell Put Scanner's Step 4 table.

> **E-2, E-3 and E-4 need a planning session before any build** — each carries a
> real design fork, called out in its Notes. E-1 needs one spec answer only.

| ID | Pri | Tab / area | Request | Notes |
|---|---|---|---|---|
| E-5 | — | ADMIN / ops | **Budget guard with auto-shutoff** (requested 2026-08-07): Vercel cron every ~10min computes daily/monthly spend from the api_calls ledger × lib/api-costs.ts unit prices; at thresholds (env: DAILY_BUDGET_HARD_STOP default $50, MONTHLY_BUDGET_HARD_STOP default $100) flips a Supabase-backed kill flag honored by resolveApiKey (cached ~60s), emails Joel via Resend (configured) with a log link, and the admin Health tab gets a Re-enable button. Prereq: Supabase metering env vars live. Layer-1 provider-side caps are Joel-side actions (AI provider consoles + OpenRouter prepaid + Vercel spend mgmt) — the app guard is layer 2. **BUILT 2026-08-07 (staging, pending UAT)** — see E-5a/b/c below for what building it uncovered. Deploy prereqs: apply `supabase/migrations/0002_ai_spend.sql`, set `CRON_SECRET`, and confirm the Vercel plan allows a sub-daily cron (Hobby caps crons at once per day — `vercel.json` asks for `*/10 * * * *`). |
| E-5a | **P1** | ADMIN / ops | **The ledger was blind to every provider that can overspend.** `meteredFetch` wraps `fetch`, so it only ever saw polygon / fmp / finnhub — all flat-rate plans whose marginal cost is $0. The pay-per-use LLMs go through the Vercel AI SDK (`generateText`/`streamText`), never through `fetch`, so nothing about the actual dollar risk was being recorded. A budget guard reading that ledger would have watched the three providers that cannot overspend and missed the five that can. **Fixed:** `recordAiCall()` in lib/metered-fetch.ts records provider/model/tokens/cost; migration 0002 adds the columns and an `api_spend_daily` view; wired into lib/ai-providers.ts (both fallback chains), the two CCPI AI routes, and the four direct-provider libs. Unknown models are priced `null`, never 0, and surface as an explicit "unpriced calls" count. |
| E-5b | **P1** | Security / cost control | **Five libs read `process.env.<PROVIDER>_API_KEY` directly, bypassing `resolveApiKey`** — so `DISABLED_APIS` never applied to them, and the new kill switch would not have either. A shutoff with a bypass is not a shutoff. Also meant the `XAI_API_KEY`/`GROK_XAI_API_KEY` and `GOOGLE_AI_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY` alias pairs were hand-duplicated in two places. **Fixed** in lib/{openai,anthropic,grok,groq-llm,google-gemini}-market-data.ts. Violated the CLAUDE.md house rule that keys resolve through lib/api-keys.ts. |
| E-5c | **P1** | Cost control | **`maxTokens` was silently ignored on two AI routes.** `/api/ccpi/chat` and `/api/ccpi/executive-summary` passed `maxTokens`, which ai v5 renamed to `maxOutputTokens` — the SDK dropped the unknown key, so output length was **unbounded** on every paid fallback. These were 2 of the 18 known typecheck errors, filed as a type nit; they were a live spend leak. **Fixed** — baseline is now 16 errors. Worth re-reading the other 16 with the same suspicion. |
| P5-1 | **P1** | ADMIN (whole section) | **Admin overhaul + audit — Joel-confirmed 2026-08-07 UAT finding:** the legacy "Full Audit" tab (app/api/admin/full-system-audit + components/admin/full-system-audit.tsx) tests only 3 hardcoded tabs (site now has 41) and reports 6 unattributed "fallback" warnings — no way to see WHICH variables are fallbacks. It is the pre-audit self-reporting machinery (once claimed "no fake data detected" during the fabrication era) and now overlaps the new Health tab. Plan: retire or rebuild Full Audit on the run-health-checks + provenance data; then Phase-6-style sign-off of EVERY admin tab (Costs, APIs, AI, Data, Keys, CCPI, Site, Backup, Ads) against the no-fake-numbers criteria in AUDIT_PLAN section 4. Sibling legacy audit routes (/api/admin/audit, /api/admin/api-status, ccpi-audit, remaining-site-status) reviewed for retire/rebuild in the same pass. |
| E-6 | — | CCPI / new tab | **"Market Warning Score" video assessment (Joel, 2026-08-08, youtube nftAePxO3HA):** ex-Goldman risk manager's 3-pillar detection model — (1) speculation/sentiment (YouTube views, Google Trends, options activity, retail attention), (2) market health (breadth: % stocks >200DMA, small-cap performance, credit spreads, volatility behavior), (3) macro/liquidity (financial conditions, credit, earnings revisions, rates). **Verdict: don't clone — CCPI already covers ~80%** (his pillar 3 ≈ our macro pillar; credit spreads/VIX/term structure/put-call/AAII/F&G all present, plus valuation which he lacks). No weightings disclosed in part 1; nothing to copy math-wise. **Real gaps worth building:** E-6a **breadth** — % of stocks above 200-DMA (our market-breadth route was retired in P5b; CCPI tracks QQQ index-level only). Feasible via Polygon grouped-daily (1 call/day, all tickers) + Supabase rolling close store; P1 for the crash chain. E-6b **small-cap relative strength** — IWM/SPY ratio slope, trivial via Polygon, add to CCPI momentum. E-6c **Correlation & Diversification Checker tab** — user enters holdings, pairwise 90-day correlation matrix from Polygon closes, flag clusters >0.75 ("you own the same stock 5 times" — his NVDA/AMD 0.90, NVDA/IREN 0.92 example), suggest low/negative-corr diversifiers per house allocation rules (sectors/indexes: GDX, XLU, SPY). Directly serves Joel's stated goal (cash + diversification ahead of corrections). E-6d StockTwits **attention velocity** (message-count Δ) as an enthusiasm input — stream already fetched for the heatmap. **Skip, with reasons:** his YouTube-views input (proprietary to his channel; r=0.86 on ~22 daily points in one month, in-sample, single regime — statistically thin, likely common-trend artifact) and Google Trends via SerpAPI ($75/mo eliminated key for a weak marginal signal). **DESIGN CONSTRAINT (Joel, 2026-08-08) — signal vs noise governs the weights:** every new indicator must earn its CCPI weight with demonstrated LEAD time on drawdowns, not correlation during them. Concretely: (1) before an indicator gets scored weight, backtest it against 2000/2008/2020/2022 drawdown starts — did it move BEFORE the index, or with it? Coincident movers are dashboards, not canaries; display them unscored. (2) Prefer the small set that historically leads: credit spreads widening while index flat, breadth narrowing under highs (E-6a), VIX term-structure flattening/backwardation, small-cap divergence (E-6b) — over sentiment surveys which are mostly coincident. (3) Every indicator's card must answer "what do I DO when this fires" (the remediation-engine principle applied to market data) — an alert with no action attached is noise by definition. (4) Canary thresholds beat continuous scores for react-ability: a discrete "X just crossed Y for the first time in Z days" fires attention; a composite drifting 34→36 does not. |
| E-7 | — | Infra / cost / speed | **Historical-data store + caching strategy (Joel, 2026-08-08):** stop re-requesting slow-moving history per page view. Today every CCPI load refetches 8 FRED series AND burns LLM calls for CAPE/Mag7/QQQ-PE/short-interest estimates; panic-euphoria re-pulls 5y SPX per view; fomc/cpi/jobs re-pull full FRED history per request. Plan, in payoff order: **E-7a** `ai_estimates` Supabase table with 12–24h TTL — the AI-fallback values change daily at most, cutting ~95% of CCPI-path LLM spend (the actual money leak; provenance + age travel with each value). **E-7b** `fred_observations` store — daily cron pulls ~15 series once; routes read Supabase (sub-second tabs, FRED-outage-proof, history for charts for free). **E-7c** consolidated market-snapshot cron at close: grouped closes (exists) + FRED batch + computed indicators (breadth ✓, VIX term structure, SMAs); trend-analysis drops flaky Yahoo for stored Polygon closes; intraday-only fetches stay live. **E-7d** ISR (`export const revalidate = 900`) on vix-history/cpi/fomc/jobs — one line each, Vercel edge-caches. **E-7b DONE 2026-08-08/09** (fred-snapshot cron, 21 series -> market_series; ccpi/macro-indicators/panic-euphoria/fomc-predictions/cpi-inflation/jobs-report all store-first with live fallback; sub-second tabs verified on staging). **Two real defects surfaced while verifying it, both now fixed + regression-tested (scripts/check-yoy.ts, 13 checks in check:formulas):** (1) **invented inflation** — CPIAUCSL/CPILFESL have no 2025-10 observation (never published); FRED returns the gap as a "." placeholder, so fixed-size requests came back one value short and /api/fomc-predictions fell through to its hardcoded `cpi: 2.9` constant. Staging served 2.9%/3.2% as live CPI/core CPI when the real figures were 3.46%/2.57%. Root fix: YoY aligns BY DATE (lib/yoy.ts), missing base month -> null. Row-offset arithmetic was ALSO wrong across the gap (13-month span labelled year-over-year) — it fooled the diagnostic SQL too. (2) **CPI chart labels** — built via `new Date("YYYY-MM-01").toLocaleDateString()`, which renders local-time, shifting every point back a month west of UTC; and the history/forecast bridge point carried the latest reading but was dated today, drawing the June figure at August. Monthly staleness gate relaxed 60d->100d (publication lag + skipped months were marking current data stale). **Still open: E-7c** consolidated close-time snapshot cron; **E-7e** historical breadth backfill computed per-day from the 400d of stored closes — gives series depth immediately and enables the E-6 lead-time backtest that gates scoring. Fits existing $10/mo Supabase (~70k new rows); no new services. Established pattern: market_closes + cron + SQL compute (E-6a). |
| E-8 | — | Data expansion | **Serper + Quiver dataset expansion (Joel, 2026-08-08 — both keys now live in prod):** test-then-build, never assume endpoints. **E-8a** Quiver off-exchange short volume / short interest → replaces the P6-8 "NYSE Short Interest" VIX-proxy in Panic/Euphoria with measured data (kills a labeled synthetic — highest value). **E-8b** Quiver WSB/Reddit mentions + sentiment → real retail-attention series for E-6d attention velocity (Reddit blocks direct scraping; this is the clean path). **E-8c** Quiver gov-contracts/lobbying → candidate COPY-section columns. **E-8d** Serper /news per ticker → headline feed for sentiment + a "news landmine" pre-trade check in the Sell Put Scanner Landmine column (free tier 2,500/mo — budget calls, cache aggressively per E-7 patterns). First step next session: probe Joel's actual Quiver tier on staging and build only against endpoints that answer with real data. Also: fix stale "free public feed" source label on congress-trades success path (key is paid now). |
| E-8e, E-8f, E-8g, E-8h | — | Data expansion 2 | **Second-wave Serper/Quiver leverage (Joel, 2026-08-08 — crash prediction + COPY):** **TIER PROBE RESULTS (2026-08-08): offexchange/govcontracts/lobbying INCLUDED; wallstreetbets + insiders 403 NOT in plan — Joel: no tier upgrades, budget at max, so E-8b and E-8e are CLOSED-WONTFIX at current tier; 13F + wikipedia 404 (endpoint-name variants untried). E-8a BUILT same day.** **PROBE ROUND 2 (2026-08-08 pm): endpoint names resolved as sec13f/sec13fchanges (Django 401-vs-404 discrimination) but both answer 403 NOT in plan; wikipedia 404 under /beta/live and /beta/historical — so E-8f and E-8h are CLOSED-WONTFIX at current tier alongside E-8b/E-8e. Only E-8g (govcontracts + lobbying, both included, 20k rows each) remains buildable from this wave. **E-8g BUILT 2026-08-08:** /api/federal-money?ticker=X serves per-ticker contract awards + lobbying spend from lib/quiver fetchQuiverDataset; verified LMT 9 contracts $24.5M / 69 lobbying filings $22.5M, unknown ticker returns 0-with-success, each feed fails independently. Display only (scored:false) per the lead-time rule; windowTruncated exposes the 20k feed ceiling. UI SHIPPED same day: COPY > "Federal Money Trail" tab (components/federal-money-trail.tsx) — ticker lookup, 90d/1y/3y windows, summary cards + detail tables, lag warning stated before any number, per-feed errors distinct from zero results, windowTruncated surfaced as "partial history", "Display only — not scored in CCPI" badge. E-8g COMPLETE.** **E-8e** Quiver AGGREGATE insider sell/buy ratio — market-wide insider flow, documented lead on tops; the single strongest new CCPI candidate (riskAppetite pillar), gate = tier includes it + lead-time backtest. **E-8f** Quiver 13F position DELTAS — upgrade hedge-fund-13f tab from filings list to actual quarter-over-quarter buys/sells per tracked fund; biggest COPY win. **E-8g** Quiver gov-contracts + lobbying as COPY columns/scanner flags. **E-8h** Quiver Wikipedia page views (market-fear pages) — cheap to backtest, weight only if it leads. Explicitly rejected per the lead-time rule: Congress aggregate selling as a scored input (30-45d lag, coincident), Serper crash-headline counts as a scored input (repriced by headline time — display only), Cramer tracker (entertainment), jet tracking (novelty display at most). |
| E-1 | — | Sell Put Scanner, Step 4 | **Export button** downloading the currently-filtered rows as a real Excel workbook, named `Date-SiteName-CriteriaCodes.xlsx`. | Export must honour the active Excel-style filters and the current sort, not the unfiltered set. **Spec decision needed:** what `CriteriaCodes` encodes — presumably a compact encoding of the active filter values (e.g. `DTE7-Y2.5-IV80`). **Implementation:** `jszip` is already a dependency, so a genuine `.xlsx` (OOXML) is buildable without adding SheetJS — do not ship a CSV with an `.xlsx` extension, which Excel warns on. **Not blocked by P1-1:** the Delta and IV % columns come from the scanner's own Polygon path, not the rebuilt `/api/strategy-scanner`. Generalise to the other scanner tables once Phase 4 lands a shared ResultsTable. |
| E-2 | — | Sell Put Scanner, Step 4 | **"Ask AI" popover on cell hover**, which on click runs a deep analysis of that option — trend analysis, ticker outlook, risk analysis — ending in a thumbs-up/thumbs-down verdict on selling the put. Example given: *"ticker has been in decline for 18 months and sees no growth in the growth market — stay away from selling puts on this dog."* | **Feasible:** the AI plumbing exists ([lib/unified-ai-fallback.ts](lib/unified-ai-fallback.ts), OpenRouter free-tier auto-router with refusal detection), and [/api/scenario-analysis](app/api/scenario-analysis/route.ts) is an existing per-request LLM route to model it on. **Forks for the session:** (1) *Cost and rate limits* — a hover affordance on a 42-row × 16-column grid invites hundreds of calls; needs click-only invocation, per-ticker caching, and a visible spend path once Phase 5 metering exists. (2) *Trigger design* — hovering **any** cell to get the same row-level analysis may be noisier than one explicit button per row; worth prototyping both. (3) **Verdict liability** — a thumbs-up/down on a specific trade sits materially closer to investment advice than anything currently on the site; the footer disclaimer covers educational content, and a directional verdict on a named ticker likely needs its own framing. (4) *Grounding* — the analysis must draw on data the site already holds (the row's own metrics, Landmine events, trend-analysis output) rather than model recall, or it will confidently describe an 18-month decline that did not happen. Highest value and highest risk of the three. |
| E-3 | — | Sell Put Scanner, Step 4 | **New "POP" column after Delta** — a real calculated Probability of Profit. | **Directly buildable now, cheapest of the three.** Phase 1 added `probabilityOTM()` to [lib/black-scholes.ts](lib/black-scholes.ts), and a Step 4 row already carries what it needs: `strike`, `currentPrice`, `dte`, real `delta` and real `iv` ([components/wheel-scanner.tsx:141](components/wheel-scanner.tsx:141), [:174](components/wheel-scanner.tsx:174)). **The one real decision:** *which* POP. (a) **Strike-based** — P(price > strike at expiry), i.e. the short put expires worthless; what most broker platforms show. (b) **Breakeven-based** — P(price > strike − premium), i.e. the trade profits even if assigned; the more honest answer for a cash-secured put, and always reads higher. Pick one, label it, and say which in the tooltip. **Also flag in the copy:** traders reading the Delta column expect POP ≈ 1 − \|delta\|, the desk approximation — a real N(d₂) POP differs by a point or two, and the tooltip should pre-empt "your math is wrong" reports. |
| E-4 | — | Sell Put Scanner, Steps 3 & 4 | **Ticker link should open Yahoo's advanced chart by default** — 1-year range, daily candles, Bollinger Bands, VWAP, and the three standard moving averages. | **Partly feasible; the session needs to settle expectations.** One inconsistency to fix regardless: Step 4 links to `/quote/{ticker}` ([components/wheel-scanner.tsx:4256](components/wheel-scanner.tsx:4256)) while Step 3 links to `/quote/{ticker}/chart` ([:3056](components/wheel-scanner.tsx:3056)) — the same click gives different destinations. Yahoo's full advanced chart is `finance.yahoo.com/chart/{TICKER}`, a straight swap. **The catch:** Yahoo offers no documented, stable way to deep-link indicator state — applied studies (Bollinger, VWAP, SMAs) and range/interval are user preferences persisted in Yahoo's own session, not URL parameters. Any query-string form found by experiment is undocumented and can break silently. **Options to weigh:** (a) link to `/chart/{TICKER}` and accept whatever indicators the user last set; (b) test a `?range=1y&interval=1d` style parameter today, knowing it may stop working; (c) render the chart in-app from Polygon data already being paid for — full control over indicators, no off-site hop, significantly more work, and the only option that delivers the request as stated. |

---

## Phase 2 findings (API contracts & health)

**Deliverables:** [lib/api-contracts.ts](lib/api-contracts.ts) — a contract per route
(canary request, zod success schema, latency budget, required keys, dependent tabs) —
and [app/api/admin/run-health-checks/route.ts](app/api/admin/run-health-checks/route.ts),
which probes them and reports per-route pass/fail. Coverage is enforced by
[scripts/check-contract-coverage.ts](scripts/check-contract-coverage.ts):
**62 routes on disk, 62 contracted, 0 gaps.**

The check distinguishes four outcomes rather than the pass/fail the old admin
tooling produced. `blocked` (key absent or killed by `DISABLED_APIS`) is separated
from `fail` (route is broken), because "TWELVE_DATA_API_KEY is unset" and "the
route 500s" need different responses. `degraded` flags a route that answered
correctly but over its latency budget.

**Run of 2026-08-07 (local dev, no API keys configured):** 8 pass, 14 fail,
24 blocked, 16 skipped. Every Yahoo/SEC/Quiver failure traced to
`UNABLE_TO_VERIFY_LEAF_SIGNATURE` in the dev-server log — TLS interception on this
machine, not a code defect. **The run must be repeated on a preview deploy with
real keys before its results mean anything about production.**

| ID | Sev | Tab / area | File:line | Finding | Fix |
|---|---|---|---|---|---|
| P2-1 | **P1** | COPY → Form 144, Politician Spotlight, Top Performers | [app/api/form-144/route.ts](app/api/form-144/route.ts), [app/api/politician-spotlight/route.ts](app/api/politician-spotlight/route.ts), [app/api/top-performers/route.ts](app/api/top-performers/route.ts) | **HTTP 200 with an `error` body.** All three answered `200 {"error": "fetch failed"}`. A caller checking `res.ok` sees success and renders an empty tab as though the data genuinely were empty. Same anti-pattern as P1-11's `/api/market-breadth`. Environment-independent: the status/body contract is wrong regardless of why the upstream failed. | Return a 5xx when the upstream fails. The health check now catches this class explicitly — a 200 carrying `{error}` is scored `fail`, not `pass`. |
| P2-2 | P2 | ANALYZE → CCPI | [app/api/ccpi/cache/route.ts:3-5](app/api/ccpi/cache/route.ts:3) | The CCPI cache is a **module-level mutable variable** (`let cachedCCPIData`). On Vercel each serverless invocation may get a fresh isolate, so writes from one request are invisible to the next and inconsistent between concurrent instances. The cache mostly does not cache. (Its 404 cache-miss response is correct and is now declared `okStatuses: [404]`.) | Move to a shared store — Supabase is already connected — or delete the route and let `/api/ccpi` own its own caching. |
| P2-3 | P3 | ops / routes | SITE_MAP.md §3 | **Orphan-route triage** (resolves P0-1). Confirmed working with no consumer: `/api/market-breadth` (but dead per P1-11 — delete), `/api/qqq-technicals` (thin wrapper over a lib that IS used — delete the route, keep the lib, per P0-3). Duplicates: `/api/scraping-bee/test` and `/api/scraping-bee/test-connection` both duplicate `/api/scraping-bee/diagnostics` and spend quota — delete both. `/api/twelve-data-proxy` vs `/api/twelvedata-proxy` (S-20) — no consumer either way; delete both unless an external caller is identified. Genuinely reachable but unused: `/api/yahoo-proxy`, `/api/fmp-proxy`, `/api/apify-proxy`, `/api/google-trends`, `/api/serper-finance`, `/api/macro-indicators`. | Each needs a keep-or-delete decision. Recommendation: delete the 6 named above; the rest carry API keys and are deployed attack surface for no benefit. |
| P2-4 | P2 | site-wide | [lib/api-contracts.ts](lib/api-contracts.ts) | **16 of 62 routes cannot be safely probed** and are marked `skip` with a reason: 6 spend an LLM call per probe, 3 are themselves fan-out audit endpoints (probing them would double every provider's call volume), 3 mutate state or send email, 4 spend metered scraping quota. They therefore have **no automated verification at all**. | Give the LLM routes a `?dryRun=1` that exercises the request path without calling a model, so they can be contract-tested. |
| P2-5 | P3 | tooling | [app/api/admin/run-health-checks/route.ts](app/api/admin/run-health-checks/route.ts) | Route handlers are bundled at build time, so `app/api` is not enumerable at runtime on Vercel. The endpoint's coverage report therefore relies on a **committed `KNOWN_ROUTES` list** that can drift from disk. | `scripts/check-contract-coverage.ts` fails the build on drift — wire it into CI alongside `typecheck` in Phase 4. |
| P2-6 | P3 | ops | Local dev | Outbound HTTPS from this workstation fails certificate validation (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) for Yahoo, SEC and Quiver, so **no upstream-dependent route can be verified locally**. Combined with an empty `.env.local`, local runs can only prove routing, auth, schema wiring and error handling. | Not a repo defect. Record it so future audit sessions do not mistake it for one; do upstream verification on a preview deploy. |

**Two defects in the health checker itself, found by running it and fixed:**
it probed auth-gated admin routes without forwarding the caller's session
(reporting five working routes as 401 failures), and it sent `symbol` to
`/api/yahoo-proxy`, which takes `endpoint` + `ticker` (reporting a parameter
mistake as a broken route). Both are why the run happened before the writeup.

---

## Phase 3 findings (formula & logic verification)

**Deliverable:** [FORMULAS.md](FORMULAS.md) — the complete calculation inventory
(~80 formulas across four domains), each with reference, verdict, numeric evidence
and fix. Produced by four parallel verification agents (indicators / option math /
composites / fundamentals), every P0 claim re-verified against source before fixing.
The table below carries only the headline findings; FORMULAS.md is canonical.

**P0 — wrong data, fixed immediately (this commit):**

| ID | Sev | Tab / area | File:line | Finding |
|---|---|---|---|---|
| P3-1 | **P0** | ANALYZE → CCPI | [app/api/ccpi/route.ts:384](app/api/ccpi/route.ts:384) | **The flagship crash index could not see volatility.** `fetchAlphaVantageIndicators` returned a hardcoded `vix: 18` on both its success and failure paths, so the `\|\|` chain never reached the live VIX; the VIX>35 crash amplifier and VIX canaries could never fire. Fixed: real FRED spot VIX (VIXCLS, already fetched by `fetchVIXTermStructure`) feeds first, AI fallback second; VXN/RVX/ATR/LTV/spotVol are now explicit named baselines instead of being laundered through a fetch that pretended to supply them (their real sourcing is P3-20). |
| P3-2 | **P0** | COPY → Cluster Buys | [app/api/insider-clusters/route.ts:96](app/api/insider-clusters/route.ts:96) | Cluster dollar values priced the insider's entire post-trade **holdings** as the purchase (Finnhub `share` = holdings after; `change` = shares transacted) — ~500× overstated for large holders. Fixed to `change × price`; rows without a usable `change` are skipped. *Field semantics corroborated by the sibling route's own comment; confirm once against a live payload on preview.* |
| P3-3 | **P0** | COPY → Insider Activity | [app/api/insider-trading/route.ts:404-416](app/api/insider-trading/route.ts:404) | Same defect as P3-2 — the code's own comment said "prefer the signed change" while the code preferred holdings; holdings (always positive) also biased the direction fallback toward "Buy". Fixed. |
| P3-4 | **P0** | ANALYZE → Index Trend Analysis | [app/api/trend-analysis/route.ts:69](app/api/trend-analysis/route.ts:69) | **The "200-day MA" was unreachable.** The route fetched 180 calendar days (~124 trading bars), so `calculateMA(…, 200)` always returned its short-series fallback — the **last close** — and the highest-weighted signal in `determineTrend` compared the price to itself. Fixed: fetch window 180→320 days (~220 bars), matching qqq-technicals. |

Also fixed while in the file: `JSON.JSON.stringify` in the CCPI cache POST (TypeError
swallowed by its catch — the cache was never populated via this path), and
`nvidiaMomentum` read from `fredData` which never carries it (the computed value was
discarded; indicator was permanently neutral).

**P1 — broken or ungrounded, scheduled (all detailed in FORMULAS.md §3):**

| ID | Sev | Area | Finding |
|---|---|---|---|
| P3-10 | P1 | CCPI | Pillar 1 branch maxima sum to 90/100 and Pillar 2 to 85/100 — the pillars cannot reach their stated scale; max attainable base CCPI ≈ 92. |
| P3-11 | P1 | CCPI | The "Fear & Greed" input is `api.alternative.me` — the **crypto** F&G index — silently scored as equity sentiment (weight 15 in Pillar 2). CNN scrape already exists in-repo. |
| P3-12 | P1 | CCPI | S-12 answered: baselined values are averaged into the composite at **full weight**; nothing consults `apiStatus`; the one null-aware input (F&G) is excluded but not renormalized. Structural bias toward the calm-2024 constants. |
| P3-13 | P1 | CCPI | "Certainty" score **rises as more warning canaries fire** (0→70%, 15→100%) and ignores how many inputs are baselined. `getPlaybook(regime)` ignores `regime` — recommends "Risk-On, 60-80% equities" in every regime including Crash Watch. Yield curve is scored three times (~20 CCPI points for one indicator). |
| P3-14 | P1 | lib/vix-term-structure.ts | "1M future" = spot × 1.08 ⇒ `isInverted` is mathematically **always false** — the module's stated purpose (backwardation crash signal) cannot trigger; CCPI's 6-pt indicator instead flags calm (VIX<15) markets as risk. |
| P3-15 | P1 | lib/unified-ai-fallback.ts | Market data (CAPE, Buffett, put/call, PMI…) "fetched" by asking LLMs for values, accepted if `> 0`, and scored identically to live data. The `> 0` filter also rejects legitimately negative series. |
| P3-16 | P1 | ANALYZE → Panic/Euphoria | 7 of 9 "components" are algebraic transforms of VIX and SPX momentum — a VIX proxy presented as a Citi replication; `latestCitiReading: 0.72` hardcoded; weekly bars mislabeled as daily MAs; the MMF input uses retail-only WRMFSL against a total-MMF band ⇒ pegs **max euphoria** whenever the FRED key works. |
| P3-17 | P1 | ANALYZE → FOMC | Methodology text claims "CME FedWatch … Fed Funds futures"; no futures exist anywhere in the code (heuristic rule ladder). `^FVX` used as the "2-year" yield is the CBOE **5-year** index, so the "2Y-10Y" inversion signal is 5Y-10Y. Decay factor goes negative at meeting 8+; meeting list ends Mar-2027 (crash after). |
| P3-18 | P1 | ANALYZE → CNN F&G | Historical deltas fabricated (`lastMonthChange = score − weekAgo×1.2`, `…×2`); scrape path always reports 0 change; fallback double-counts VIX and `calculateMarketVolatility` ignores its own MA parameter. |
| P3-19 | P1 | ANALYZE → CCPI | Remaining frozen inputs after P3-1: `bullishPercent: 58` hardcoded; ATR/VXN/RVX/LTV/spotVol named baselines with no source — each still contributes fixed points to pillar scores. Source or remove. |

**P2/P3 highlights (rest in FORMULAS.md):** trend-analysis MACD guard `<26` yields
histogram≡0 at 26-33 bars (wheel's is 34) · SMA short-series returns 0 ⇒ IPOs always
"uptrend"/golden-cross (P3-24) · wheel-strategy-planner "premium % of stock price"
overstated **100×** (P3-25) · learn-pmcc worked example double-counts the short-call
credit (P3-26) · trade-walkthrough renders iron condors as a 2-leg call vertical
(P3-27) · S-9 confirmed order-of-magnitude (est. premium ~80× overstated for OTM
weeklies) · S-15 confirmed + inverse bug (profitable-quarters silently lowers the
bar) · D/E is actually liabilities/equity and negative equity **passes** the debt
gate · landmine CPI dedupe drops the second month in a window · panic-euphoria MAs
computed on weekly bars · RSI Cutler-vs-Wilder quantified: mean 5.8 pts, oversold
gate flips on 12.6% of windows (S-2 evidence).

---

## Phase 5b findings — ADMIN SECTION AUDIT (2026-08-07, two read-only agents)

> **STATUS 2026-08-07 (end of session): A-1 … A-15 are all addressed** on the
> `audit-preview` staging branch (commit `9f4259c`), awaiting the owner's UAT and
> merge to production. Retired 11 route dirs + 3 support files (4,248 lines);
> rebuilt `api-status`, the AI tab, `data-source-status` and the CCPI admin tab;
> deleted the zip-slip write primitive and gated the three unauthenticated routes.
> Routes 62 → 51, admin tabs 11 → 9, TS errors 20 → 18, all four check suites green.
> §4's "no fake numbers anywhere on the admin page itself" now holds.
> The findings below are kept as the record of *why* — do not re-open without evidence.

**Verdict: AUDIT_PLAN §4 "No fake numbers anywhere on the admin page itself" FAILS on 6 of 11 tabs.**
~2,700 lines across 5 routes produce zero measurements while emitting the site's strongest false assurances.

| ID | Sev | Area | Finding | Fix |
|---|---|---|---|---|
| A-1 | **P0** | Full Audit tab | `testApi()` defined at [route.ts:161](app/api/admin/full-system-audit/route.ts:161) and **never called** — 0 network requests. 90 indicators = 54 literal `"live"` + 2 literal `"fallback"` + 34 env-ternaries. Only 1 of 90 can ever be `"failed"` and fallback counts as working, so **`verdict:"PASS"` is unreachable-by-failure in every possible environment** (floor 98.9% vs 90% threshold). Owner's screenshot (84 live / 6 fallback / 2ms) reproduced exactly from source. | RETIRE route + component; Health supersedes |
| A-2 | **P0** | Full Audit tab | The 6 fallbacks are **unattributable by construction** — only `summary.fallbackApis` renders ([full-system-audit.tsx:334](components/admin/full-system-audit.tsx:334)), no list or filter. Identified for the owner: RSI / MACD / SMAs / Bollinger (env-ternary on kill-switched `twelveDataKey`) + Equity Fund Flows + Congressional Trading (hardcoded literals). | Dies with A-1 |
| A-3 | **P0** | Full Audit tab | `Math.random() * 15` progress bar + 14 scripted "Checking…" strings on timers ([full-system-audit.tsx:73-103](components/admin/full-system-audit.tsx:73)) decorating a 2 ms static response. Violates the CLAUDE.md no-`Math.random()` rule **inside the admin itself**, and is what makes the fake numbers look credible. | Dies with A-1 |
| A-4 | **P0** | /api/admin/audit | 5 real probes but ~20 hardcoded `"VERIFIED"` plus **5 hardcoded codeQuality PASSes including "No Math.random() usage"** ([:561](app/api/admin/audit/route.ts:561)) — asserted while Phase 1 found six `Math.random()` P0s in one route. Describes CCPI as **6 pillars / 23 indicators** (real: 4 / 29). `import { AbortSignal } from "abort-controller"` shadows the global so `.timeout` is undefined → **FMP always reports failure**. Unreachable from the UI (dead handlers). | RETIRE |
| A-5 | **P0** | Data tab + CCPI tab | [/api/data-source-status](app/api/data-source-status/route.ts) is an object literal with `summary{live:8, aiFallback:7, baseline:0, failed:0}` hardcoded and `new Date()` glued on so it reads as freshly measured. Because `baseline:0`/`failed:0` are literals, the UI's "some APIs are using baseline data" warning **can never fire**. Names a phantom **"BarChart API"** provider that exists nowhere in the repo. Also feeds the correctly-rebuilt CCPI tab, injecting stale provenance into the one panel that was right. | REBUILD from `ccpi.provenance` (real three-tier data already exists); add auth |
| A-6 | **P0** | Site tab | [/api/remaining-site-status](app/api/remaining-site-status/route.ts) — 531 lines, all 47 indicators literal `"live"`. Its renderer hardcodes **"100% Formulas Documented / 100% Data Sources Verified / 0 Hidden Calculations"** and "no fake data, no random numbers pretending to be live" ([remaining-site-audit.tsx:236-256](components/remaining-site-audit.tsx:236)) — the least true text on the site. A field-shape mismatch means the headings render blank anyway. | RETIRE route + component + tab |
| A-7 | **P0** | AI tab | **Fallback order is backwards, and it is cost-relevant.** Claims OpenAI is tried first; the real chain ([lib/ai-providers.ts:29](lib/ai-providers.ts:29)) is OpenRouter-free #1, OpenAI #4. Hardcoded latencies ("1.2s"…"3.2s") are rendered as measured. Prose says "all 4 AI providers" while the route lists 7. | REBUILD generated from `providerConfigs` |
| A-8 | **P0** | CCPI tab | 26 unguarded `.toFixed()` calls on indicators the route may emit as `null` → TypeError swallowed by the catch → **permanent "Loading CCPI Audit…" spinner** with no error surfaced. `nvidiaMomentum \|\| 50` invents a value. `validateCCPI` uses the pre-rework non-renormalized formula, so a null pillar yields a false green "VALID" or a bogus "DISCREPANCY". | Null-guard → "—"; validate against `baseCCPI` + `provenance` |
| A-9 | **P1** | Security | **No auth on three routes** (verified by grep): `/api/ai-status` (discloses which API keys are configured), `/api/data-source-status` and `/api/remaining-site-status` (enumerate the provider stack and fallback chains). `run-health-checks` is admin-gated for precisely this reason. | Add `isAuthenticated()` or retire |
| A-10 | **P1** | Security | [/api/admin/restore](app/api/admin/restore/route.ts:25) unzips attacker-controlled paths into `process.cwd()` with **no zip-slip guard** — the filter blocks `node_modules`/`.git`/`.env` but `../` passes. It has never worked (read-only serverless FS) and has zero UI consumers: an authenticated arbitrary-file-write primitive that does nothing but exist. | RETIRE immediately |
| A-11 | **P1** | APIs tab | Kill-switch blind: reads `process.env` directly, never `resolveApiKey`/`isServiceDisabled`, so **SerpAPI renders green "✓ KEY SAVED" while kill-switched** (the owner's screenshot). Finnhub shows red because the route probes `/v1/quote` — an endpoint the app never uses — and reports any non-2xx as the false diagnosis "Invalid or expired API key". The route returns a `message` with the real reason and **the UI never renders it**. 9 of 19 providers are returned `"online"` on key-presence alone. 200-with-error-body (Alpha Vantage / TwelveData rate limits) is scored healthy. | REBUILD thin over the api-keys helpers; render `message`; add an explicit "not probed" state |
| A-12 | **P1** | Ads tab | Module-level in-memory `adsData`: POST returns success, dies at cold start, invisible across instances. `fetchAdData` is **never called**, so Save POSTs `images:[]` and the server treats `[]` as truthy → **wipes the list**. The public banner never reads the API at all (hardcoded URLs). | Persist to Supabase or retire the tab; remove the false "saved successfully" alert |
| A-13 | **P2** | Costs tab | `usageCount` comes from `lib/api-usage.ts`, whose `recordApiUsage` is **called from nowhere** in the repo → permanently 0, rendered as "0 calls (this instance)". Superseded by `metered-fetch`. | Delete the field and lib, or render "—" |
| A-14 | **P2** | Backup tab | "Every code change is automatically committed to GitHub" — false, and it contradicts the CLAUDE.md staging → UAT → merge rule. Ships dead `getAllFiles` code. | Fix the copy; delete the dead function |
| A-15 | **P3** | Keys / APIs copy | Alpha Vantage still described as "VIX, VXN, ATR, SMA" — VXN and ATR were deleted in the provenance rework. | Update copy |

**12 tab-vs-tab contradictions catalogued** with file:line on both sides — including Full Audit's permanent PASS vs Health's 4 real failures; CCPI described three incompatible ways across three tabs (4 pillars/29 indicators vs 6 pillars/23 vs a header claiming 32 while the payload returns 1); SerpAPI green in APIs but "Not Set" in Keys; Finnhub red in APIs but passing in Health.

**Disposition:** RETIRE 5 (`full-system-audit`, `admin/audit`, `admin/ccpi-audit`, `remaining-site-status`, `admin/restore`) · REBUILD 3 (`api-status`, `data-source-status`, `ads`) · KEEP 3 (`admin/usage`, `admin/backup`, `run-health-checks` — the standard the rest should be measured against).

---

## Closed

Fixed in the Phase 1 commit (`audit Phase 1: …`).

| ID | Sev | What changed | Verification |
|---|---|---|---|
| S-1 | P0 | `calculateMACD` in [components/wheel-scanner.tsx:682](components/wheel-scanner.tsx:682) now computes the signal line as the 9-period EMA of the MACD *series*, mirroring [app/api/trend-analysis/route.ts:155](app/api/trend-analysis/route.ts:155). Minimum history raised 26 → 34 bars so the signal EMA has a full window. | `pnpm check:formulas` — [scripts/check-macd.ts](scripts/check-macd.ts) proves the old signal collapsed to `sign(macd)` at **every** point of a rise-then-rollover series, and that the new one diverges from `sign(macd)` on 12 bars, leads in an uptrend and lags in a downtrend. |
| P1-1 | P0 | `getIVData` reads real `implied_volatility` from Polygon's options snapshot, averaged across contracts within 5% of the money at the nearest expiry ≥7 days out. Returns `null` when the chain is unavailable — no fallback. `ivRank`/`ivPercentile` are now `null` everywhere: a true IV rank needs 52 weeks of IV history the route does not collect. Filters that keyed off the fake rank now key off measured ATM IV. | Endpoint choice matches the working Sell Put Scanner path ([app/api/polygon-proxy/route.ts:59](app/api/polygon-proxy/route.ts:59)). **Not yet exercised against live Polygon** — `.env.local` is empty locally. Needs a preview-deploy check. |
| P1-2, P1-3, P1-4, P1-5, P1-6 | P0 | Every `Math.random()` removed from [app/api/strategy-scanner/route.ts](app/api/strategy-scanner/route.ts). Butterfly POP is now `probabilityBetween` over the profit zone; LEAPS delta and ZEBRA position delta are Black-Scholes; calendar `daysNoEarnings` comes from a batched Finnhub earnings call; ZEBRA `stockScore`/`trend`/`optionVolume` are withheld as `null` along with the tooltips that described them as fundamental analysis. | `grep -n "Math.random" app/api/strategy-scanner/route.ts` returns comment references only. |
| P1-7, P1-8 | P0 | `estimateCreditSpreadPremium` → `priceCreditSpread`: both legs priced with Black-Scholes at measured IV, credit = short − long, probability = N(d₂) with the 50–95 clamp removed. `calculateDelta` → `optionDelta` via N(d₁). Iron-condor probability now uses the joint `probabilityBetween` instead of multiplying two one-sided probabilities as if independent. | `pnpm check:formulas` — [scripts/check-black-scholes.ts](scripts/check-black-scholes.ts), 22 assertions: Hull's published call 4.76 / put 0.81, put-call parity, delta identities with and without dividends, IV round-trip, and null-on-degenerate-input. |
| P1-9 | P2 | `FALLBACK_PRICES`, `CALENDAR_FALLBACK_PRICES` and the `\|\| 100` default deleted; a ticker with no verified price is skipped. LEAPS fundamentals are `null` for tickers absent from the hand-maintained table. `marketCap` strings inferred from share price removed. | — |
| P1-10 | P1 | New [components/pricing-provenance.tsx](components/pricing-provenance.tsx) replaces the "Live Data"/"LIVE" badge on all six scanner tabs, stating the measured-vs-derived split and that the figures are theoretical mids rather than quotes. Its `Metric` helper renders `—` for null instead of `0`. | — |
| P1-12 | P2 | Both keys in `/api/strategy-scanner` now resolve through `resolveApiKey()`, so `DISABLED_APIS` and the alias table apply. Timeouts added to all three outbound fetches. | — |

**Behaviour change to expect.** Rows now require a verified price *and* measured IV,
so the six scanner tabs will return fewer setups than before — and zero if the
Polygon options snapshot is unavailable on the current plan. That is the intended
result: an empty table means "could not be established", which the payload states
via `incomplete`. Several columns (IV Rank, IV Percentile, Stock Score, Option
Volume, Price Stability, IV Skew, conviction badges) now render `—` because
nothing sources them. **This needs a preview-deploy check before it reaches
users** — see P2 verification note.

_Superseded 2026-08-11 by the §STATUS LEDGER._ This line was the file's second
status record and it had gone wrong twice — first as `S-2 … S-20 except S-1`, then as
the corrected list below, which by 2026-08-11 still called P0-2, P0-3, P0-5 and P1-11
"still real" after each had been closed. **A summary of statuses maintained beside the
statuses is a copy, and copies drift.** Read the ledger.

> _Kept as the record of the drift:_ "**still real:** P0-1 … P0-7, P1-11, P1-13, P1-14,
> plus the seven re-located rows below. **Already done:** S-2, S-6, S-11, S-12, S-13,
> S-14, S-15, S-19, S-20. **Partial:** S-5 (21 → 10 TypeScript errors)."

**The seven stale wheel-scanner rows are re-located, and all seven survive** (2026-08-10). Every one cited `components/wheel-scanner.tsx` line numbers the Wave-2 split invalidated — that file went 4,439 → 386 lines and the code moved to `components/scanner/*`. Each row now carries its new coordinates; none turned out to have been fixed in passing by the split. Two things the re-location itself surfaced:

- **S-8 got a misleading comment out of the move.** `use-wheel-scanner.ts:111` now reads `// This variable is declared but not used in the provided code snippet` beside `minVolumeTechnicals`. It *is* used — `technical-criteria.ts:39` filters on it. A comment asserting that a live filter is dead is worse than no comment.
- **S-18 got worse.** The step numbers were duplicated across nine files by the split. 40 literal `Step N` strings now, with no shared constant. Splitting a file does not fix a copy problem; it multiplies it.

Fixed in the Phase 3 commit (`audit Phase 3: …`):

| ID | Sev | What changed | Verification |
|---|---|---|---|
| P3-1 | P0 | CCPI reads real FRED spot VIX (via `fetchVIXTermStructure`) instead of a constant 18 laundered through `fetchAlphaVantageIndicators`; the dead AI fallback is now second in the chain; the other five volatility fields are explicit named baselines. Also wired `nvidiaMomentum` to the value actually computed, and fixed the `JSON.JSON.stringify` cache-write TypeError. | Verified frozen paths by direct read of both return sites before editing; independently found by two of the four verification agents. Live behavior needs the preview-deploy pass. |
| P3-2, P3-3 | P0 | Insider trade values/quantities now use Finnhub `change` (shares transacted), never `share` (post-trade holdings); rows without a usable `change` are skipped rather than valued off holdings. | Field semantics per Finnhub docs + the sibling route's own comment. Confirm against one live payload on preview. |
| P3-4 | P0 | trend-analysis fetch window 180→320 calendar days so the 200-day MA is computable instead of silently rendering the last close as an MA. | 180d ≈ 124 trading bars < 200 (agent numeric check); `calculateMA` fallback confirmed by direct read. |

Fixed in the Phase 4 Wave-1 commit (three parallel build agents, disjoint file ownership):

| ID | Sev | What changed | Verification |
|---|---|---|---|
| S-2, S-6 (partial), P3-24 | P2 | **`lib/indicators.ts`** — one shared, pure, null-contract indicator suite (Wilder RSI, O(n) MACD, SMA-seeded EMA, population-σ Bollinger, raw %K, Wilder ATR). All four duplicated copies rewired onto it; ~130 lines of closures deleted from wheel-scanner. Null never becomes 0: the IPO false-golden-cross (`sma=0` ⇒ `uptrend` always true) is gone — unknown SMAs now fail the gate. Wilder RSI changes Step-3 filter outcomes by design (oversold gate flips on ~12.6% of test windows). | `scripts/check-indicators.ts` 24/24 (StockCharts RSI vector 37.79 exact; MACD Δ 0.00e+0 vs textbook); `check-macd.ts` 7/7. Also caught in passing: `processSymbol` passed an explicit `180` that silently defeated the P3-4 fetch-window fix. |
| P3-10, P3-11, P3-12, P3-13, P3-14, P3-19, S-12 | P1 | **CCPI scoring core rework** (`lib/ccpi/scoring.ts`, pure + load-time-asserted): every pillar's maxima now sum to exactly 100; yield curve scored once (macro); unsourced indicators (VXN/RVX/ATR/LTV/spotVol/bullishPercent) deleted; three-tier provenance (live / ai-estimate / baseline) with baseline **exclusion + renormalization** and per-pillar null below 40 scored weight; certainty = pure data-quality (canaries no longer raise it); playbook branches on regime; amplifier ordering fixed (−10% day now hits the −9 branch); **crypto F&G replaced with CNN's equity index**; vix-term-structure now real VIX3M/VIX ratio from FRED VXVCLS (inversion detectable at last); AI-fallback `>0` filter → per-metric plausibility ranges. Response stays backward-compatible; `provenance` added. | `scripts/check-ccpi-scoring.ts` 35/35, re-run independently. Route's 11 pre-existing TS errors → 0. |
Fixed in the Phase 4 Wave-2 commit:

| ID | Sev | What changed | Verification |
|---|---|---|---|
| S-6 | P3 | **wheel-scanner.tsx split**: 4,377 lines → entry (386) + 16 modules under components/scanner/, all ≤600. Verbatim-line audit: only intended edits differ. One inherent behavior fix: the tooltips toggle was wired to a nonexistent prop (silently dead) and now works. | tsc 0 in all 17 files; `pnpm check:formulas` passes; app/page.tsx untouched. |
| — | P2 | **ccpi-dashboard aligned with the scoring rework**: 93→0 TS errors; null pillars render "insufficient data"; provenance line per pillar; certainty relabeled "Data Quality"; ratio-convention term-structure gauge; dead indicator cards deleted (six audit-admin entries would have thrown reading removed API fields); yield-curve card moved to Macro; indicator counts corrected (29 = 10/4/7/8). lib/ccpi/types.ts pillars now `number \| null`; calculations.ts composite renormalizes over non-null pillars (same fix as the API) and validateCCPI no longer false-alarms on null. | tsc 0 in owned files; check-ccpi-scoring re-passes. |
| P3-25, P3-26, P3-27 | P2 | Planner "%% of stock price" 100× fix + $Infinity guard + assignment-zone bound; PMCC example $400→$200, $1,100→$1,300; walkthrough condors render all 4 legs; collar prose sign fixed; payoff kinks land on samples. | Figures recomputed in the agent report; owned files 0 errors. |
| P4-1 | P3 | **components/wheel-strategy-planner.tsx is dead UI** — exported, imported by no page (only SITE_MAP.md §3-adjacent references). Its math is now fixed; decision needed: wire to a LEARN tab or delete. | Repo-wide grep. |
| P4-2 | **P1** | **Password-reset flow is non-functional by construction** ([app/api/auth/reset-password/route.ts](app/api/auth/reset-password/route.ts)): (1) the emailed link targets `/reset-password`, a page that does not exist in `app/` — it 404s; (2) the token is `Math.random()`, never stored or validated by anything; (3) the credential is the `ADMIN_PASSWORD` env var, which no web flow can change, so no reset implementation is even possible in this design. The login UI nonetheless reports "Password reset email sent! Check your inbox." Discovered live when the admin was locked out. Fix: either remove the reset UI + route and say "contact the administrator" (honest, matches the env-var design), or move admin auth to a real store (Supabase is connected) with a genuine token flow. | Confirmed by code read + the user's lockout. **FIXED 2026-08-07 (staging)** — took option (a), the honest one: the endpoint now returns 501 with the real recovery procedure instead of a fake success, the `Math.random()` token and the dead `/reset-password` link are gone, the login UI shows recovery instructions rather than "Reset email sent!", and the email-existence oracle (404 vs 200) is closed. A genuine token flow stays impossible until admin auth moves off the env var — see P4-4. |
| P4-3 | **P1** | **Admin login had no brute-force protection and compared the password with `===`** ([app/api/auth/login/route.ts](app/api/auth/login/route.ts), [lib/auth.ts](lib/auth.ts)). Unlimited guessing at network speed against a single static credential, with a non-constant-time comparison that leaks length and content through timing. Tolerable while the admin was read-only; not tolerable once the admin can trip the budget guard — and disqualifying for the pasteable-API-keys feature (P4-4). **FIXED 2026-08-07 (staging):** per-IP sliding-window rate limit (10 failures / 15 min, `LOGIN_MAX_FAILURES` + `LOGIN_WINDOW_MINUTES`) backed by the Supabase `login_attempts` table — in-memory counters cannot work on serverless, where each lambda has its own memory. Constant-time comparison of both email and password, `ADMIN_PASSWORD_HASH` (scrypt, no new dependency) preferred over plaintext `ADMIN_PASSWORD`, generator at `scripts/hash-admin-password.ts`. **Rate limiting fails OPEN** if Supabase is unreachable — deliberate, because the owner has already been locked out once and there is no self-service reset. Migration `0003_login_attempts.sql`. |
| P4-4 | — | **Admin-managed API keys (requested 2026-08-07):** paste/rotate provider keys from the admin instead of Vercel env + redeploy. Design agreed: service-role-only Supabase table, encrypted at rest with `ENCRYPTION_KEY`, **write-only** API (returns presence/last-4/source/updatedAt, never a key value), pasted key overrides the env var with the UI saying so, and the same cached-snapshot pattern the budget guard uses to feed the synchronous `resolveApiKey`. Gated on P4-3, now done. Also fold in: move admin auth off the env var into that same store, which is what makes a real password-reset flow possible (unblocks the second half of P4-2). Note `ENCRYPTION_KEY` is currently marked **Non-sensitive** in Vercel — flip it to Sensitive before it protects anything. |
| P6-1 | **P1** | **Three tabs told users to retry forever on a permanent auth failure.** `/api/congress-trades`, `/api/politician-spotlight` and `/api/top-performers` each called Quiver Quantitative with no credential — just a User-Agent — because all three headers claimed it was a "free public feed" needing "no key". Quiver answers **401**. All three then rendered *"Quiver Quant rate-limited briefly. Try again in a moment."* A 401 is not a rate limit and retrying never succeeds. Found in Joel's 2026-08-07 UAT as three separate 502s; it is one missing key. **FIXED (staging):** new `lib/quiver.ts` centralises auth, status mapping and metering; `QUIVER_API_KEY` added to `API_KEY_ALIASES` (+ the remediation mirror and provider dashboard); 401/403 now reported as "credentials rejected — will not resolve on its own", 429 alone keeps the retry copy, and an absent key returns **503 "not configured"** rather than a 502 implying upstream breakage. The three contracts declare `requires: ["QUIVER_API_KEY"]`, so the health check now reports one blocked cause instead of three unexplained failures. **Owner decision outstanding:** Quiver is a paid API — either buy a plan or retire the three tabs. Until then those tabs correctly report unconfigured. Also needs an `API_COSTS` entry once a tier is chosen (deliberately not added with an invented price). |
| P6-2 | P3 | **`/api/fmp-proxy` was a hardcoded 410 with no consumers** — the entire route body returned `{ error: "FMP API endpoints require premium subscription" }`. Nothing in the repo called it and it served no tab. **RETIRED (staging):** route, contract entry, `KNOWN_ROUTES` line and remediation path-hint all removed. `FMP_API_KEY` itself stays — still used by `lib/fmp-valuation.ts` and `/api/polygon-tickers`. |
| P6-4 | **P0** | **CCPI dashboard rendered invented AAII numbers.** ScrapingBee is kill-switched, so `aaiData` is never live — yet `aaiiBearish \|\| 30` / `aaiiSpread \|\| 5` painted "30.0%" and "+5.0" with two-decimal precision on every load. **FIXED (staging):** undefined when not live; the dashboard's existing `!== undefined` guards hide the cards. |
| P6-5 | P2 | **Dead "AI Structural" constants deleted from the CCPI payload** — aiCapexGrowth 40 / aiRevenueGrowth 15 / gpuPricingPremium 20 / aiJobPostingsGrowth −5, hardcoded, shipped on every response, zero consumers. |
| P6-6 | **P0** | **One dead FRED series scored a constant as live data.** `fetchFREDIndicators` fell back per-series (`\|\| "5.33"` etc.) while stamping the whole object `source:"live"`, and the tier map used one blanket `fredTier` — so a single missing observation entered the CCPI as an invented number marked live. **FIXED (staging):** observations parse to null, never constants; macro tier map is per-series; the catch-path baseline object now carries nulls so it can't masquerade. |
| P6-7 | P2 | **CCPI burned an LLM call per load for a value nothing consumed** — `fetchShillerCAPEWithGrok()` inside fetchFREDIndicators fed `fredData.shillerCAPE`, which no consumer reads (the scored CAPE is the tiered `shillerCAPEResult`). Both call sites removed. |
| P6-8 | **P1** | **Panic/Euphoria tab: 7 of 9 "components" were synthetic transforms of SPX/VIX**, two of them literally re-plotting SPX momentum as "commodity prices" (`280+m*2`) and "gas prices" (`3.2+m*0.01`); "putCallRatio" is a VIX 5d/50d ratio, not a put/call ratio; the Margin Debt tooltip claimed "SOURCE: FINRA via FRED" — a fabricated provenance. Citi reading 0.72 / "Nov 7, 2025" hardcoded. **PARTIAL FIX (staging):** commodities → FRED PPIACO, gas → FRED GASREGW (real series, null + dropped from composite when unavailable); composite divides by components actually scored; FINRA lie corrected to "SYNTHETIC PROXY"; payload carries `syntheticComponents[]`; Citi card labeled "last published reading". **REMAINING:** SI/margin/II/AAII/"putCallRatio" are still VIX-derived proxies (tooltips now say so) — real sources or removal is a rebuild decision for Joel. |
| P6-9 | P2 | **panic-euphoria's local SMA returned the last price — or 0 — when history was short**, silently presenting a non-average as an average. Now lib/indicators.ts `sma` with throw-on-insufficient-history (honest 500). House rule: indicators only from the shared lib. |
| P6-10 | P2 | **market-sentiment precedence bug:** `100 - x \|\| 50` — a volatility score of exactly 100 produced 0 → falsy → silently 50. Parenthesized + `??`. |
| P6-11 | **P1** | **Sentiment heatmap was a hallucination pipeline billed as sourced data.** The route asked an LLM for "the past 24 hours of StockTwits discussions" — the model has no live access to any source — and the payload claimed "sentiment analysis from StockTwits, financial news, and market forums". It also called paid gpt-4o-mini FIRST via a local generateText, bypassing the free chain, metering AND the budget guard. **FIXED (staging):** routed through the shared metered/guarded chain; prompt asks for a general impression and forbids invented specifics; dataSource now reads "AI-estimated (no live feed queried)"; payload carries `estimated: true`. **Open decision:** rebuild on real sources (lib/sentiment-sources.ts already reads Finnhub/Polygon news) or retire the tab. |
| P6-12 | **P1** | **25+ raw `process.env` key reads across 13 files** bypassed resolveApiKey — DISABLED_APIS, the budget guard, and the P4-4 admin paste-a-key panel none applied (a pasted SERPER_API_KEY would never reach /api/google-trends). All swapped to resolveApiKey. Same class as E-5b; this closes the remainder. |
| P6-13 | P3 | **Module-size debt (P6 sweep):** 19 modules >600 lines; worst ccpi-dashboard.tsx 3,189, ccpi-audit-admin 1,634, market-sentiment 1,600, strategy-scanner route 1,480. Split opportunistically. Also greeks-calculator carries a correct-but-duplicated Black-Scholes implementation (math verified against standard formulas) — fold into lib/black-scholes.ts when next touched. |
| P6-14 | **P1** | **Panic/Euphoria MMF component pegged at max-euphoria whenever FRED was live.** WRMFSL (retail MMF, ~$1.4T — the series Citi's model actually calls for) was normalized against a hardcoded 5.0–7.0 $T total-market range; value below range → clamp → permanent max reading. **FIXED (staging):** percentile-of-own-history normalization (~5y window) — a series scores against itself, no hand-picked range can drift again. Same treatment applied to the new real margin-debt series (FRED Z.1 BOGZ1FL663067003Q). Server ships componentScores so client bars can't recompute with stale ranges. |
| P6-15 | P2 | **social-sentiment tab: silent failures + decorative fallbacks.** Failed fetches were console-only — the tab showed stale cache with no failure notice; and headline scores fell back to `47`/`54`/`50` — constants chosen to LOOK measured (47 reads more "real" than 50). **FIXED (staging):** visible error banner on fetch failure; scores render "—"/"no data" when the field is missing (gauge markers keep a neutral 50 position — visual midpoint, not a claim). Wave-2 sweep of the other 13 fetching tabs found honest failure paths everywhere else (6 COPY tabs render their routes' success:false message bodies; 5 ANALYZE tabs have setError states; congress trio fixed in P6-1). |
| P6-3 | P2 | **The health check was measuring a path the UI never takes, and paying for it.** `/api/earnings-calendar` reported *degraded* at 20,713ms against a 20,000ms budget. The component calls `?skipAI=true` and fills explainers in afterwards via `/insights`; the canary omitted the flag, so every probe took the slow path — **up to 25 LLM calls per run** — while the sibling `/insights` contract is skipped for precisely that reason. Same class as the yahoo-proxy canary bug: the canary was wrong, not the route. **FIXED (staging):** canary now sends `skipAI=true` and the budget drops 20s → 10s. Measured on staging after the fix: **1.26s**. |

| S-5 (major progress), P2-1 | P1/P2 | **TS errors 210 → 146** (ai SDK v5 `maxOutputTokens` rename across 5 provider libs, `NextResponse.json` conversions, union widening, use-ccpi-data typing). **P2-1 fixed:** form-144 / politician-spotlight / top-performers / congress-trades now return 502 on upstream failure instead of 200-with-error-body — COPY tabs show error states instead of silently-empty tables. Top-performers `$50M+` single-value parse fallback added (largest trades no longer drop from dollar-weighted XR). | Per-file counts 0 in all owned files; contract alignment noted (errorShape already scored 200+error as fail). |

Fixed in the FOMC nullability commit (2026-08-09):

| ID | Sev | What changed | Verification |
|---|---|---|---|
| P6-16 | **P0** | **`/api/fomc-predictions` invented the economy when FRED was quiet.** Six `\|\| { current: 4.1, … }` fallbacks (unemployment, CPI, core CPI, PCE, GDP, payrolls), plus `currentRate … : 4.5` and the Yahoo treasury `\|\| 4.5` / `\|\| 4.3`, were not display-only: they fed `predictionScore`, `fedDecisionFactors` and the per-meeting implied-rate model, so a FRED outage produced a confident Fed forecast built on made-up inflation and unemployment. E-7b made the fallbacks rarer, not honest. **FIXED (staging):** every indicator is nullable; null inputs are excluded from the score and from the signal set rather than substituted (a signal whose input is missing simply never fires); `previousMeeting` is null instead of collapsing onto the current rate; treasuries are null instead of 4.5/4.3. The route reports a per-input `provenance` block (tier + source + `unavailable` + `keyInputsMissing`), mirroring the CCPI per-field tier pattern, and **503s rather than publish a forecast anchored on a stand-in Fed Funds rate**. UI renders "—" plus "insufficient data" per missing input, tags the prediction "Qualified — insufficient data" when a key input is missing, lists what the model actually read, and **withholds the options strategies** in that state. Also removed the client's 4.375 seed rate and the chart's 24-flat-month fallback series (it read as "rates never moved"). | `pnpm typecheck` 13 → **11** (the two `meetings: any[]` baseline errors are also gone; no new errors), `pnpm check:formulas` and `pnpm check:contracts` pass. All three states exercised against the running dev server: **unavailable** (no FRED key locally → 503, every card "—", no prediction), **degraded** (CPI withheld → amber banner, qualified tag, strategies suppressed), **full** (banner absent, strategies restored). |
| P6-17 | P2 | **`^FVX` is the 5-year Treasury yield, not the 2-year.** `/api/fomc-predictions` fetched it from Yahoo, labelled it `treasury2Y`, and derived both the yield-curve read and the "Inverted (2Y > 10Y)" copy from it — so the curve signal was a 5s10s spread presented as 2s10s. **FIXED (staging, same day):** both legs now come from FRED constant-maturity series through the same store-first path as everything else in the route — `DGS10` (already stored) and `DGS2` (added to the fred-snapshot cron + `STALENESS_DAYS`). Yahoo is no longer a dependency of this route at all, so the tab is FRED-outage-shaped rather than two-provider-shaped, and `dataSource` says so. | typecheck 11 (unchanged), check:formulas + check:contracts pass; route exercised locally — provenance reports `FRED:DGS10` / `FRED:DGS2`. **Needs a staging check for live values:** `DGS2` has no stored history until the next fred-snapshot run, so it serves live-FRED until then (and stays null on staging until the backfill Joel is blocked on). |

Fixed in the fallback-constant sweep commit (2026-08-09):

Swept `app/api/**` and `lib/**` for the P6-16 pattern — `|| <const>` / `?? <const>`
standing in for missing data. Nine sites found; the two that actively mislead are
fixed below, the rest are logged as P6-20.

| ID | Sev | What changed | Verification |
|---|---|---|---|
| P6-18 | **P0** | **CNN Fear & Greed tab shipped invented component readings.** Five fields were *literal constants*, not fallbacks — `vix: 0, putCallRatio: 0, stockPriceMomentum: 0, volatilitySkew: 0, openInterestPutCall: 0` on every response — and eleven more silently became `50` when CNN's payload lacked that indicator, all under `dataSource: "CNN API + Live Market Data"` and `methodology: "Using CNN's actual Fear & Greed scores"`. On a 0-100 fear scale, 0 is EXTREME FEAR and 50 is a real NEUTRAL reading; neither is "unknown". The headline `cnnData.fear_and_greed?.score \|\| 50` was the worst: a CNN response without a score painted a measured-looking "Neutral 50" gauge. **FIXED (staging):** headline score missing now throws to the existing 503 error path; component scores resolve through a `firstScore()` helper returning null; the `every(score === 50)` fallback sentinel tests for null instead; a null score gets `sentiment: null` (it used to be labelled "NEUTRAL" because every comparison against null is false); the five literal zeros are null; payload carries `unavailableComponents[]` and an honest `methodology`. Client: `MarketData` fields nullable, the seven `?? 50` component defaults removed — including two that were unit errors as well as invented (`?? marketData.vix` put a raw VIX level on a 0-100 sentiment scale, and `putCallRatio * 50` manufactured a score from a ratio) — "NO DATA" badge in grey rather than neutral-yellow, and an amber banner naming what CNN did not supply. Also removed the "50-Day MA" tile, which rendered `vixVs50DayMA * 50 + vix` — a linear combination of a ratio and a spot level — to two decimals as if it were a moving average; nothing in the payload carries that series. Also fixed in passing: the scraped branch's `putCallRatio = 1.0 // Default neutral` reported as measured, and an SPY momentum figure divided by a hardcoded 125 regardless of how many closes came back. | typecheck 13 → **10** (no new errors), check:formulas + check:contracts pass. **Not exercised in-browser** — CNN is unreachable from the dev sandbox, so the route returns its honest 503 there and the component-missing path could not be driven. **Needs a staging look at the tab.** |
| P6-19 | **P1** | **Two LLM prompts were told "0/100" for pillars that were never scored.** A CCPI pillar is null when under 40 of its 100 weight came from live or AI data (P3-10) — but `/api/ccpi/chat` interpolated `${pillars?.momentum \|\| 0}/100` and `/api/ccpi/executive-summary` `${pillars.momentum}/100` with a `?? { momentum: 0, … }` default behind it. **On the CCPI scale 0 is not "unknown", it is maximum crash signal** — the exact opposite reading — and both surfaces then reason and give allocation guidance from it. **FIXED (staging):** both prompts render "insufficient data — excluded from the composite" and carry an explicit DATA GAP instruction telling the model not to infer a reading; `ccpi`/`certainty`/`activeWarnings` print "unavailable" rather than 0; ccpi-dashboard passes nulls through and `CCPIChatModal`'s prop type admits them. Also corrected two stale claims the same prompts made: "aggregates 34 market indicators" (the real figure is 29) and `totalIndicators: canaries.length`, which narrated "3 of 12" against a 29-indicator index. `TOTAL_SCORED_INDICATORS` now derives from the weight tables in `lib/ccpi/scoring.ts` instead of being hand-written in three places, so it cannot drift again. | typecheck (the pre-existing ccpi-dashboard pillars error is resolved by the nullable prop type); check-ccpi-scoring 35/35 still passes. |
| P6-22 | P2 | **Three Fear & Greed components now read "NO DATA" on production** — the honest consequence of P6-18, but a gap worth closing. `marketVolatility` (Yahoo `^VIX` meta price), `putCallRatio` (nothing in the codebase fetches one — the old value was a literal `1.0` reported as measured) and `stockPriceMomentum` (needs >=125 SPY closes; the old code divided by a hardcoded 125 regardless of how many came back). Four of seven components are real: strength 85.2, breadth 49.4, junk 65.5, safe-haven 73.3, CNN headline 63.7. **Fixes available without new spend:** VIX already exists in `lib/vix-term-structure.ts` and `/api/vix`; SPY closes are in the `market_closes` store from E-6a, which removes the Yahoo dependency and the short-series problem together; put/call has no free source and should either stay null with a "not tracked" label or be dropped from the component list rather than sit permanently empty. | Verified on production 2026-08-09 after the second merge. Not a regression — those three previously showed invented values under a "live data" label. |
| P6-21 | **P1** | **The yield curve reported "Inverted (Recession Signal)" on a perfectly normal curve.** P6-17 corrected the SERIES but left the spread computed as `treasury2Y - treasury10Y` while the readout tested `spread < 0` for inversion — a test that is only correct for the `10Y - 2Y` orientation. On live staging figures (2Y 4.25, 10Y 4.69, i.e. a textbook upward-sloping curve) `/api/fomc-predictions` returned `yieldCurve: "Inverted (Recession Signal)"` with `yieldCurveSignal: "bearish"`, and the Fed tab rendered a red "Recession Signal" badge. Found by reviewing the P6-16..P6-19 batch on staging before merge, not by a test. **FIXED (staging):** `lib/yield-curve.ts` owns the convention — `spread = 10Y - 2Y`, positive normal, negative inverted, matching FRED's own `T10Y2Y` that the CCPI macro pillar already reads, so the exported number can be compared against any published 2s10s figure without a sign flip. Adds a Flat band (<=20bp) so a near-flat curve is not reported as cleanly Normal; the UI badge says "Flattening" for it. | `scripts/check-yield-curve.ts` — 17 checks pinning the exact staging figures as the regression case, plus a genuine inversion, the flat band, the zero boundary and null legs. Wired into `check:formulas`, now 119 checks. typecheck 10, contracts 57/57, remediation 31/31, build clean. **Lesson recorded: a sign convention is not reviewable by reading — it needs a test with real numbers in it.** |
| P6-20 | P2 | **Remaining sweep hits — all seven now FIXED (staging, same day).** (a) **CCPI crash amplifiers bypassed the tier system**: `calculateCrashAmplifiers` read `qqqDailyReturn`/`qqqBelowSMA50`/`vix`/`putCallRatio` straight off the assembly layer, where they are `\|\| 0` and `\|\| false`, so with QQQ unavailable it evaluated "0% daily return, not below the 50-day SMA" as fact. `AmplifierInputs` is now nullable, baseline-tier inputs are passed as null and never fire a bonus, and the result carries `unavailableInputs[]` so a +0 bonus is not read as "no acute event" when it means "could not check". (b) **insider-clusters / insider-trading** `t.change * (t.transactionPrice \|\| 0)`: unpriced trades now contribute null, `totalDollarValue` is null when nothing in the cluster was priced, and both routes report `pricedBuys`/`unpricedBuys`/`unpricedTransactions` so a ranked total is not read as complete. `buildCorporateNote` no longer calls an unknown-size trade small. (c) **google-trends** averaged over the keywords *requested* rather than the keywords *returned*, so one missing keyword halved the fear score — a data gap reading as calm markets; now averages over matches, null when none, and `interpretation` is null rather than falling through to "Greed". (d) **jobs-report** `?? 150` invented a payrolls figure and forecast a ±35K band around it — `nfpPrediction`/`nfpRange` are null without an observation, `fmtK(nfp3MonthAvg ?? 0)` no longer prints "+0K" as a 3-month average, and four prose fallbacks that asserted a direction on missing data ("Payroll momentum softening", "Hiring remains resilient", "Wage pressures persist", "Wage growth steady") now say the data is unavailable. (e) **trend-analysis** `highs[i] \|\| 0` / `lows[i] \|\| 0` survived the `price > 0` filter, feeding $0 extremes into ATR and the Bollinger bands; bars missing any OHLC leg are dropped. (f) **strategy-scanner** `marketCapitalization \|\| 0` fell through every threshold and labelled the ticker "small-cap"; cap and size tier are null when unknown. (g) **lib/ccpi/logger.ts** `\|\| 34` stale count → "unavailable". | typecheck 10 (unchanged, no new errors); `scripts/check-ccpi-scoring.ts` grew 3 assertions for (a) — all-null inputs score 0 and report all four as unavailable, and a partially-available set still scores what it can while naming the rest — 38/38 passing; check:contracts 57/57. |

Fixed in the E-7c commit (2026-08-09):

| ID | Sev | What changed | Verification |
|---|---|---|---|
| E-7c (part 1 of 2) | — | **Consolidated close-time snapshot cron.** Breadth (21:30) and fred-snapshot (21:45) ran as two independent crons 15 minutes apart, and the indicators DERIVED from them had no ordering guarantee — a slow FRED run meant breadth and the VIX ratio were computed against yesterday's inputs. New `/api/cron/market-snapshot` runs the three steps in order: Polygon grouped closes → FRED sweep → computed indicators (breadth RPC + VIX term structure). A failing step no longer skips the ones after it; each reports its own `ok` and the response is ok only when all three are. The job bodies moved to `lib/market-snapshot.ts`, and `/api/cron/breadth` + `/api/cron/fred-snapshot` stay as thin wrappers so the `?backfill=` URLs already in use keep working. `lib/cron-auth.ts` replaces the constant-time CRON_SECRET check that was copy-pasted into every cron. **Also:** `VIXCLS` + `VXVCLS` added to the FRED sweep, so `fetchVIXTermStructure` is store-first (was a live FRED pair on every CCPI load) and reads through `resolveApiKey` instead of raw `process.env` (last P6-12 holdout). Both legs of the ratio must come from the SAME stored day — pairing a stale spot VIX with a fresh VIX3M manufactures a ratio move out of a data gap, and that ratio crossing 1 IS the backwardation signal. `SPY`/`QQQ` added to the stored ticker set (they are ordinary US-listed ETFs, already in the grouped response, so zero extra API calls); `compute_breadth` still divides by `BREADTH_UNIVERSE.length` so the chart proxies cannot change a published denominator. | typecheck 10 (unchanged), check:formulas 122/122, check:contracts 58/58, `pnpm inventory` regenerated. **Unverifiable locally** — cron needs CRON_SECRET + Supabase + Polygon. Needs a manual staging run. |
| E-7c (part 2) | — | **trend-analysis off Yahoo, behind migration 0009.** The blocker was schema: `market_closes` held `(ticker, day, close)` while the tab computes ATR from highs/lows and reports volume against a 10-day average, so a close-only swap would have silently dropped ATR. Migration `0009_market_closes_ohlcv.sql` adds nullable `high`/`low`/`volume`; the snapshot now writes them from the `h`/`l`/`v` already present in the grouped-daily bar it was fetching (still zero extra API calls). New `lib/market-closes.ts` reads stored bars store-first and returns **null, never a short array**, when it cannot supply 200 bars with every leg present or the newest bar is more than 6 days old — a partial history is exactly what produced the "200-day MA" that was really the last close, and a bar missing high/low would make ATR read a violent session as calm. Columns are nullable on purpose (pre-0009 rows have no OHLC) and the reader stops at the first incomplete bar rather than substituting the close for a missing leg. Response now carries `historySource` / `priceSource` / `priceAsOf`. A Yahoo outage no longer blanks a symbol that has stored bars — the last stored close stands in, labelled, with `change`/`changePercent` **null** rather than a fabricated flat day (the client's `?? 0` printed "+0.000%"). `^SPX` stays live: Polygon's grouped stock endpoint carries no indices. | typecheck 10 (unchanged), formulas 122/122, contracts 58/58, inventory regenerated. **Requires migration 0009 + a `?backfill=` run before the store can serve — until both, every symbol simply stays on the Yahoo path.** |

Fixed in the E-7e commit (2026-08-09):

| ID | Sev | What changed | Verification |
|---|---|---|---|
| P6-89 | **P1** | **A commit broke `pnpm check:formulas` on staging and the suite went on reporting success.** (Recorded 2026-08-09 as an unnumbered row titled "REGRESSION (mine, caught here)"; given an ID during 7.1 so a programmatic pass can see it. Outside the P6-38…P6-88 block Phase 6 counted.) **`pnpm check:formulas` was broken on staging by the E-7c commit `2c27691`.** Making `lib/vix-term-structure.ts` store-first added `@/lib/...` imports to it, and `scripts/check-ccpi-scoring.ts` loads that module under node's native type stripping where the `@/` alias does not resolve — so the suite died at the CCPI checks and everything after it (YoY, yield curve) never ran. The rule was already written at the top of `lib/ccpi/scoring.ts` and I broke it anyway. **FIXED:** the pure maths moved to `lib/vix-term.ts`, deliberately import-free, re-exported from the original module so no importer changes. Lesson for the ledger: **a check suite that a commit stops running looks identical to a check suite that passes** — the only signal was the count, 53 PASS lines instead of 122. Count the checks, do not just grep for FAIL. |
| E-7e | — | **Per-day historical breadth + the lead-time backtest that gates CCPI scoring weight.** `compute_breadth()` wrote exactly one row (the latest day), so 400 days of stored closes contained ~200 computable breadth days that were never computed. Migration `0010` adds `compute_breadth_range()`, which walks every day with a full 200-close lookback using a **trailing** window (`rows between 199 preceding and current row`) — averaging the whole history into every row would be lookahead bias, i.e. a backtest that cheats. Same honesty rule as before: a ticker votes on a day only with a complete 200-close history. **Retention conflict fixed in the same migration:** `prune_market_closes()` deleted everything older than 400 days, so the next daily cron would have destroyed any deep backfill loaded for a backtest; the window is now a parameter defaulting to 1100 days (~3 years, ≈77k rows). The zero-arg function is DROPPED first — `create or replace` with a new signature adds an overload, and the cron's no-arg call would have kept resolving to the old 400-day version while the migration looked applied. **New `lib/breadth-backtest.ts`** is pure and built to be able to say no: `insufficient-history` is its own verdict and never a pass; an episode the series cannot span reports `covered: false` with the reason rather than a lead of zero; a signal that never fired gets `leadDays: null`, not 0; a permanently-true signal fires once, not once per day. Every result carries the survivorship warning (the universe is a 2026 membership list, so the constituents that fell hardest in 2000/2008 are missing by construction) and restates the E-6 gate so a verdict cannot be read as authorisation. New `/api/breadth-backtest` (`?recompute=1` to fill the series first). | `scripts/check-breadth-backtest.ts`, **23 checks**, wired into `check:formulas` — suite now **145**. Covers every refusal path plus the trigger-credit rule (a firing is credited to the day the run STARTED; crediting the completion day understates lead by `sustainDays-1`). typecheck 10, contracts 59/59. **The migration and the deep backfill are Joel's to run; until then the route honestly answers `insufficient-history`.** |

Fixed in the P6-22 commit (2026-08-09):

| ID | Sev | What changed | Verification |
|---|---|---|---|
| P6-22 | P2 | **Two of the three "NO DATA" raw indicators now measured; the third named as untrackable.** P6-18 correctly removed their invented constants (a literal `vix: 0`, a `vixVs50DayMA * 50 + vix` "moving average", an SPY momentum divided by a hardcoded 125 whatever came back) and E-7c then stored the inputs needed to compute them honestly. **`vix`** = latest FRED `VIXCLS` from the store, live Yahoo meta price as fallback. **`vix50DayMA`** = the real 50-day mean of VIXCLS via `lib/indicators.sma`, which returns null on short history rather than averaging whatever it has — so the restored tile reads "Insufficient stored history" until 50 observations exist, never a partial-window mean dressed as a 50-day average. **`stockPriceMomentum`** = SPY versus its 125-day MA from `market_closes`; new `getStoredCloses()` reads closes without requiring the 0009 OHLC columns, so this works off the data already in the table instead of waiting for that backfill. **`putCallRatio` stays null permanently** and is named in a new `notTracked[]` — nothing in the codebase sources one and there is no free feed, and the UI now distinguishes "CNN did not send this today" from "no source for this exists", so nobody chases a feed that is not there. **Deliberately NOT done:** none of these are wired into the seven CNN component scores. They are raw quantities on their own scales (a VIX level, a percent versus a mean); turning them into 0-100 components would mean inventing a transform CNN has never published and rendering it beside CNN's own figures as if it were one — the same mistake as the `\|\| 50` defaults, just with more arithmetic in front of it. | typecheck 10 (unchanged), formulas 145/145, contracts 59/59. **Both new values depend on the E-7c snapshot having run** — until then the store is empty and the fields stay null on their existing fallbacks. |

Fixed in the Wave 3 ledger commit (2026-08-09):

| ID | Sev | What changed | Verification |
|---|---|---|---|
| P6-23 | **P1** | **`pnpm inventory` silently erased the audit sign-off ledger, and had already done it.** SITE_MAP §6 is labelled "Hand-maintained" but lives inside a fully generated file: `scripts/site-inventory.ts` emitted a fresh all-☐ table on every run. CLAUDE.md tells you to run `pnpm inventory` whenever routes change, so the workflow the project mandates destroys the record of what has been verified. **It was not hypothetical — 33 marks across 41 tabs were wiped by `af2e324` (E-6a) and nobody noticed for two days**, because a blank ledger is indistinguishable from one nobody has filled in yet. The session handoff was still reporting "36/41 tabs partially ticked" against a file that had been blank since. **FIXED:** the generator now reads the marks back out of the current SITE_MAP.md and merges them by tab id; new tabs default to ☐ and are named under the table, and tabs that no longer exist are listed as dropped rather than vanishing silently. The 33 lost marks were recovered from `71a278a` and restored. | Regenerated twice and byte-compared: **idempotent**, 33 marks survive. Recovery diffed against `71a278a`. Lesson for the ledger: **a hand-maintained section inside a generated file is a bug unless the generator reads it back** — and the failure is invisible, because the erased state looks like the initial state. |

| P6-24 | P2 | **Two static calculators graded an empty form.** Both parse their inputs with `Number.parseFloat(x) || 0`, so an untouched tab computed with zeros and fell through to the last branch of its verdict ladder. **earnings-iv-crusher** showed **"LOW" IV-crush risk in green** with the recommendation *"LOW RISK environment. IV is not significantly elevated above historical levels."* — trading advice derived from two blank boxes. **risk-rewards** graded itself **"Poor" in red**, which is the opposite error: a missing input is not a bad trade. **FIXED (staging):** every verdict is gated on having the inputs it needs — `ivCrushRisk`/`ivCrushLevel`/`expectedMove*` are null without both IV legs or without a price and a straddle, the recommendation returns null and the card says what to enter, unknown risk renders grey rather than the green "LOW" gets, and the ROI grade shows "—" plus the missing fields. Reviewed and NOT changed: the `vs SPY (10% avg)` and `vs Dividend ETFs (4% avg)` benchmarks are hardcoded, but the assumption is stated inline in the label, which is the honest form for a long-run planning constant. | typecheck 10 (unchanged), formulas 145/145, contracts 59/59. Ledger `data`+`err` ticked for both tabs (`copy` too for risk-rewards, benchmarks reviewed). Remaining zero-mark tabs: `wheel-scanner`, `federal-money`, the four `learn-*` pages and `exit-rules`. |

| P6-25 | **P1** | **Two wrong numbers in the LEARN worked examples, and an unfixed TTM defect in the scanner.** (a) **learn-csp** stated an *"unrealized loss of $300"* immediately followed by the formula `($4,700 − $5,000 + $200)`, which evaluates to **$100** — cost basis $48 against a $47 stock is $1/share. The formula was right and the headline number was wrong. **FIXED.** (b) **learn-leaps** claimed that with SPY at $115 against a $120 entry, *"Shares would have been +$0 to +$500"*. Shares bought at $120 are worth $11,500 — a **$500 LOSS**. The error ran the wrong way in the tab's central lesson, flattering shares against the LEAPS. **FIXED**, and the comparison now states both sides. Same file carried three mutually contradictory rules of thumb for LEAPS cost (a code comment saying 18-25%, a step saying 20-30%, and a worked example at 15% with a strike 16.7% below spot — so the page taught a rule its own example broke); harmonised to 15-30% with the example named as the shallow end. A `whenToUse` bullet reading *"You don't need the leverage to amplify gains — a deep ITM LEAPS has roughly 3-5× the leverage"* argued against itself inside a list of reasons TO use it; rewritten. **learn-cc and learn-pmcc were re-derived line by line and are exactly correct** — no changes. (c) **NOT FIXED, logged:** [components/scanner/fundamental-scan.ts:197](components/scanner/fundamental-scan.ts:197) builds "TTM figures from the last 4 quarterly rows (graceful when fewer exist)" — `ttmRows = qRows.slice(0, 4)` then sums with `\|\| 0` / `?? 0` per quarter. A company with two reported quarters yields a two-quarter sum **presented as trailing twelve months**, which understates earnings and inflates every P/E and EPS derived from it. "Graceful when fewer exist" is the defect written down as a feature. Left alone deliberately: `eps`, `net_income` and `marketCap` feed the scanner's filters and display in ways that need tracing before they can be made nullable, and this is the site's most-used SCAN surface. Also [components/scanner/enrichment.ts:395](components/scanner/enrichment.ts:395) sorts by distance from −0.3 delta using `(a.delta \|\| 0)`, so a contract with unknown delta is ranked as though its delta were 0. | learn-cc/pmcc arithmetic re-derived independently; typecheck 10, formulas 145/145, contracts 59/59. federal-money audited and clean — `money()` returns null and rows without a parseable amount are filtered out, so totals sum only what the feed returned. Ledger: math+copy ticked for the four learn pages, data+err for federal-money. |

| P6-26 | **P1** | **The scanner's "TTM" figures were whatever quarters happened to exist (P6-25(c), now fixed).** `ttmRows = qRows.slice(0, 4)` summed net income and EPS with `\|\| 0` / `?? 0` per quarter under the comment "graceful when fewer exist" — so two reported quarters became a two-quarter total presented as trailing twelve months, understating earnings and inflating every P/E, EPS and ROE built on it. **FIXED:** a TTM figure now requires four quarters, each actually reported, or it is null. `net_income`, `eps`, `peRatio`, `marketCap`, `roe` and `debtToEquity` are all nullable and propagate. Three consequences were worse than the sum itself and are also fixed: (1) `last4EPS` fell back to `[eps,eps,eps,eps].map(v => v/4)` — **four identical synthetic quarters manufactured from the total, an invented earnings history with zero variance, under a comment claiming "Real per-quarter EPS"**; now null. (2) `total_liabilities \|\| 0` and `stockholders_equity \|\| 0` reported a company with no balance sheet as **debt-free**, the most flattering possible reading of an unknown; now null. (3) an unknown ROE compared as `0 < minROE` and was rejected under "ROE below minimum", quoting a fabricated 0.0% — it now fails under `fundamentalsIncomplete` and the notice says the financials are short of four quarters. Emitted `ttmQuarters` so the table can explain a "—" instead of leaving it blank; the results table renders "—" with a tooltip for market cap, ROE and P/E and sorts unknowns last rather than tying them with a genuine zero. Also [components/scanner/enrichment.ts:394](components/scanner/enrichment.ts:394): sorting by proximity to −0.30 delta used `(a.delta \|\| 0)`, so a contract with no delta scored 0.30 away — identical to a respectable −0.60 — and could be selected as the closest to target; unknown now sorts last. | typecheck 10 (unchanged), formulas 145/145, contracts 59/59. Blast radius traced before editing: `eps`/`peRatio`/`last4EPS` have no consumers outside the scan and the type; `marketCap`/`roe`/`debtToEquity` reach only `fundamental-results-table.tsx` and the rejection-reason labels. **Not exercised against live Polygon** — needs a staging scan run. |

Applied / found on 2026-08-09 (owner authorised production migrations):

| ID | Sev | What changed | Verification |
|---|---|---|---|
| Migrations 0009 + 0010 | — | **APPLIED to production Supabase `bwgmwritiqgpojzastlm`** on the owner's explicit instruction. Pre-flight confirmed the assumptions rather than trusting them: `market_closes` was `(ticker, day, close)` only, `prune_market_closes()` existed as the zero-arg 400-day version, `compute_breadth_range` did not exist. 0009 added nullable `high`/`low`/`volume`; 0010 added the trailing-window range compute and replaced the pruner with a 1100-day default, dropping the zero-arg overload first so the cron cannot keep resolving to the old one. | `list_migrations` shows both. `compute_breadth_range(100)` then wrote **131 days** of breadth (2026-01-30 → 2026-08-07, sample 99/100 each day) where `breadth_daily` had held exactly **1 row** — the latest-day-only defect, made visible the moment a range existed to compare against. Store state at the time: 32,858 closes, 100 tickers, 2025-04-15 → 2026-08-07. |
| E-7e verdict (first real run) | — | **`insufficient-history`, which is the correct answer.** The computed series starts 2026-01-30; all four drawdown peaks (2000-03-24, 2007-10-09, 2020-02-19, 2022-01-03) precede it, so every episode reports `covered: false` and no lead time is claimed. This is the harness working, not failing. Breadth stays unscored in the CCPI. Reaching even the 2022 episode needs a Polygon backfill of ~4 years, and 2000/2008 stay untestable regardless — the universe is a 2026 membership list, so the constituents that fell hardest are missing by construction. | Series bounds read from `breadth_daily`; the covered/uncovered branch is pinned by `scripts/check-breadth-backtest.ts` ("history ending before the peak is uncovered", "a series far shorter than the lookback is insufficient, not a lead"). |
| P6-27 | **P1** | **A breadth constituent went dark for seven months and nothing said so.** `MMC` (Marsh & McLennan, very much still listed) has 188 stored closes ending **2026-01-13**; every other ticker runs to 2026-08-07. Because breadth divides only by tickers holding a full 200-day history, the published number stayed honest — `sample_size` quietly read 99/100 for months while a constituent stopped existing. The design degraded gracefully and that is exactly why nobody noticed: **silence is not the same as "nothing to report"**. **FIXED (staging):** the snapshot now diffs the grouped response against the universe and returns `missingTickers[]`, with a `console.warn` naming them. **Still open:** why MMC dropped out (symbol change, or the grouped feed omitting it) and whether the 188 stored rows should be repaired — needs one live grouped call to inspect, which is a staging/production run. | Found by querying the store directly: `select ticker, count(*), max(day) ... having count(*) < 200`. |
| P6-28 | P2 | **The app could not report which admin credential it was running on.** The only signal that auth was still on the plaintext `ADMIN_PASSWORD` was a server-side `console.warn` nobody reads, so "did the hash migration land?" had to be taken on trust from outside the box. **FIXED (staging):** `/api/admin/run-health-checks` now returns a `security` block — `adminPasswordSource` (`hash`/`plaintext`/`unset`), `adminPasswordPlaintextStillPresent` (both set means the migration is half-done and the plaintext is a second, weaker key to the same door), `cronSecretConfigured`, `encryptionKeyConfigured`, plus plain-English notes. Names and booleans only: no value, no prefix, no length. | Behind the existing admin auth gate. |
| P6-1 CLOSED | — | **Quiver plan purchased (owner, 2026-08-09) and the licensed key is live in production.** All four Quiver-backed routes verified answering 200 with real rows: `/api/congress-trades` (79 trades), `/api/politician-spotlight`, `/api/top-performers`, `/api/federal-money?ticker=NVDA`, each reporting `source: "Quiver Quant (licensed API)"`. The "owner decision outstanding — buy a plan or retire the three tabs" item is resolved. **Consequence to act on: E-8b (WSB), E-8e (insider aggregate) and E-8f (13F) were marked CLOSED-WONTFIX on the strength of 403s from the FREE tier. That reason no longer holds** — they need one authenticated `/api/cron/quiver-probe` run to find out what the paid plan actually includes. Re-opened pending that probe. | Live probes against production. `CRON_SECRET` is set on both production and staging (a cron route answers 401, not the 503 it returns when unconfigured), so the probe itself needs the owner's secret. |

Legacy backlog triage + S-3 fix (2026-08-09):

| ID | Sev | What changed | Verification |
|---|---|---|---|
| S-3, S-4 | **P1** | **The economic calendar invented events and invented the numbers on them.** `lib/economic-events.ts` built its calendar from date arithmetic and fed BOTH `/api/earnings-calendar` and `/api/landmine-check` — the latter existing solely to warn a trader off opening a position in front of an event. Two separate fabrications: (1) every Thursday's jobless-claims entry carried `forecast: "~220K", previous: "~215K"` — numbers from nowhere, rendered in a forecast column; (2) FOMC dates came from `(month === 11 && day === 17\|18) \|\| (month === 0 && day === 28\|29)` — **the December 2024 and January 2025 meetings hardcoded as an annual recurrence**, so the calendar announced a rate decision every 18 December and 29 January forever and produced NOTHING for the other six meetings a year. A landmine check that stays quiet before six of eight FOMC meetings is worse than no landmine check. **FIXED:** new `lib/fomc-schedule.ts` holds the committed Fed schedule as the single source of truth, and `/api/fomc-predictions` now reads it too — the list was duplicated there, so the two surfaces could disagree about when the Fed meets, and did. Rule-derived events survive because the publication RULE is the fact (claims on Thursdays, Employment Situation on the first Friday); their invented figures are now null and consumers render "—". CPI keeps its inferred mid-month window but carries `approximate: true`, because BLS publishes those dates and no arithmetic reproduces them. | New `scripts/check-fomc-schedule.ts`, **14 checks**, wired into `check:formulas` — suite now **159**. It cannot verify dates against federalreserve.gov (human maintenance) but it catches how a hand-kept schedule rots: out-of-order entries, a decision day before day 1, a meeting that is not two days, duplicates, and a year that lost a meeting. One check exists purely to pin the old bug: 18 Dec 2026 is NOT a decision day (the 2026 December meeting is the 15-16th). |
| **Legacy S-item triage** | — | **The backlog's own summary line was materially wrong.** `_Not yet fixed:_ S-2 … S-20 except S-1` has been carried since Phase 1 and is the line a future session reads to plan work. Verified against the current tree: **S-2 DONE** (trend-analysis imports the shared `lib/indicators`), **S-6 DONE** (wheel-scanner 4,439 → 386 lines), **S-12 DONE/RETIRED** (`app/api/market-breadth` no longer exists; E-6a replaced it), **S-13 DONE in code** (zero `REDDIT_CLIENT` references remain — only the Vercel env cleanup is outstanding, and that is a dashboard action), **S-15 DONE** (thin-financials tickers now yield null rather than 0 — closed by P6-26), **S-19 DONE** (`lib/metered-fetch.ts` — E-5 metering), **S-20 DONE/RETIRED** (both twelvedata proxies gone, P6-2), **S-5 PARTIAL** (21 → 10 TypeScript errors). **Still real: S-11** (3 direct `aaii.com` references in social-sentiment), **S-14** (FMP screener path in polygon-tickers). **Unverified: S-7/S-8/S-9/S-10/S-16/S-17/S-18** — every one cites `components/wheel-scanner.tsx` line numbers from when that file was 4,439 lines; the Wave-2 split moved the code to `components/scanner/*` and the references no longer resolve, so each needs re-locating before it can be called open or closed. | Each claim checked by inspection of the current tree, not from memory. |

Quiver paid-plan probe, 2026-08-10 (authenticated run by the owner):

| ID | Sev | What changed | Verification |
|---|---|---|---|
| E-8b, E-8e, E-8f | — | **The paid plan does not include them, so the closures stand — but for a better reason than before.** They had been closed on the strength of free-tier 403s; when the owner bought a plan I re-opened them, because a closure resting on a condition that changed is not a closure. The authenticated probe answers: `wallstreetbets` **403**, `insiders` **403**, `sec13f` **403**, `sec13fchanges` **403**. Same verdict, now measured against the tier actually held rather than inferred from an older one. **Included and licensed (200 with rows):** `congresstrading` 1,000 · `offexchange` 5,469 · `govcontracts` 20,000 · `lobbying` 20,000 — exactly the four datasets the shipped tabs run on, so nothing was bought and left unused. | Probe output pasted from an authenticated production run, 2026-08-10T02:33Z. |
| E-8h | P3 | Both Wikipedia candidates returned **404**, and on this API that distinction matters: **403 is what "not in your plan" looks like** (all four unlicensed datasets above say 403), while 404 means the route does not exist. So E-8h is blocked on the endpoint spelling, not on money — worth exhausting before writing it off. Three more variants added to the probe (`wikipediapageviews`, `wikipedia_page_views`, `pageviews`) for the next authenticated run. | The 403-vs-404 split is visible in the probe output itself: licensed datasets 200, unlicensed 403, unknown routes 404. |
| E-8i | P3 | **A licensed column nobody reads.** The `offexchange` rows carry `DPI` — Quiver's Dark Pool Index — alongside the `OTC_Short`/`OTC_Total` that E-8a already scores. It is included in the plan and currently discarded. Before anyone designs an indicator around it, the per-ticker history route needs probing for depth (added to the probe as `offexchange-historical`), and then it faces the same E-6 gate as everything else: **display-only until a lead-time backtest earns it scoring weight**. Logged rather than built — an unused column is an idea, not a finding. | `sampleKeys` in the probe output: `["Ticker","Date","OTC_Short","OTC_Total","DPI"]`. |

Size-budget pass, 2026-08-09:

| ID | Sev | What changed | Verification |
|---|---|---|---|
| S-6 (ccpi-dashboard) | P3 | **components/ccpi-dashboard.tsx 3,196 → 2,877 lines.** Three purely mechanical extractions, no behaviour touched: `components/ccpi/indicator-primitives.tsx` (tooltip, gradient bar, both indicator rows), `components/ccpi/tooltip-copy.ts` (the canary and crash-amplifier copy — 110 lines of string maps, no JSX, no imports) and `components/ccpi/pillar-bits.tsx` (provenance line + the null-safe pillar score). **Still 2,277 over budget**; the remaining bulk is the component's JSX body, which needs the state graph traced before it can be cut safely and is not something to do without a browser to verify in. | Verbatim audit: each extracted block diffed against the original at HEAD and is **byte-identical apart from the added `export ` keyword**. typecheck 10 (unchanged), formulas 159/159, contracts 59/59. |
| P6-29 | P2 | **An entire directory of duplicate CCPI components that nothing imports.** `components/ccpi/` already held `ccpi-indicator.tsx`, `ccpi-boolean-indicator.tsx`, `ccpi-gradient-bar.tsx`, `ccpi-indicator-tooltip.tsx`, `ccpi-canary-card.tsx`, `ccpi-pillar-section.tsx`, `ccpi-status-badge.tsx` and an `index.ts` barrel — an earlier extraction that was **never wired up**, while `ccpi-dashboard.tsx` went on using its own private copies of the same components. Nothing outside the directory imports the barrel; the only external referrer is `components/ccpi-indicator.tsx`, which is itself a re-export shim that nothing imports either. So it is dead code that has been quietly diverging from the live copies — and the gradient bar in particular already differs (the unused copy carries a "No data" guard the live one did not). **Found while doing the S-6 split**, which is the only reason it surfaced: I nearly added a third copy. **FIXED (staging) 2026-08-10:** deleted, after the consumer check this deserved. Nine files went, not eight — the seven components plus `index.ts`, plus the top-level `components/ccpi-indicator.tsx` shim, which was the barrel's only external referrer and had no referrer of its own. Confirmed by symbol grep across the tree (`CCPIGradientBar`, `CCPIIndicator`, `CCPIBooleanIndicator`, `CCPIIndicatorTooltip`, `CCPIStatusBadge`, `CCPICanaryCard`, `CCPIPillarSection`): after excluding the directory itself and the stale worktree copy, the only live consumer is `ccpi-dashboard.tsx`, which imports `ccpi/indicator-primitives`, `ccpi/tooltip-copy` and `ccpi/pillar-bits`. **Nothing needed porting first.** The gradient-bar divergence recorded above closed in the S-6 split itself — the live `indicator-primitives.tsx` carries the same "No data" guard. The one component with no live counterpart, `CCPIStatusBadge`, renders a Live/Baseline/Failed badge off a boolean; that model was deliberately replaced by the per-pillar provenance line and the tier system, so restoring it would have reintroduced the display the P3 scoring rework removed. `components/ccpi/README.md` rewritten to describe the three modules that are actually there, and to record why this directory has no barrel. | `grep` for the barrel and for each module across the tree, excluding the directory itself. Post-delete: typecheck 10 (unchanged), formulas 159/159, contracts 59/59, remediation 31/31. |
| P6-30 | **P1** | **The Social Sentiment tab published 50/100 "Neutral" when every one of its seven sources was down** — the P6-18/P6-19 defect, one tab over, missed by that sweep because the constant is a `let` initialiser rather than a `\|\| 50`. `/api/social-sentiment` opened with `let globalScore = 50` and only overwrote it when at least one source was live; `macro_sentiment` and `social_sentiment` each fell back to that same number, so a purely social reading was echoed as the macro reading and vice versa. The 50 was then **fed to the LLM** (`Global social sentiment: 50/100. What does this mean for options traders this week?`), and the component's `?? 50` turned it into "Neutral conditions - consider iron condors or strangles" plus a three-strategy list, with the gauge needle parked dead-centre on "Neutral". **Confirmed live, not theorised:** in the dev sandbox all seven sources are unreachable, and the route returned exactly that. **FIXED (staging):** the three scores are `number \| null`; a null global score short-circuits the LLM call and returns an explicit "no reading" summary with an empty strategy list; the UI covers the gauge with "No live sentiment reading" instead of centring the needle, drops the two band markers, prints the strategy section as "no live sentiment reading to base them on", and sends the AI-scenario dialog a context that says so; `data_quality` gains a `NONE` tier, and its old `\|\| "MEDIUM"` / `\|\| 10` display defaults are gone. | `curl localhost:3000/api/social-sentiment` with no network: `global_social_sentiment: null`, `data_quality: "NONE"`, `sources_available: 0`. |
| P6-31 | P2 | **AAII survives elsewhere in the app, and the CCPI copy is worse than the one just deleted.** Dropping the Social Sentiment pillar (S-11) deliberately left the rest alone; this row records what is still there so it is not mistaken for closed. (a) **`app/api/ccpi/route.ts:981` — `const aaiiBullish = data.aaiiBullish \|\| 35`**, a fallback constant of exactly the kind the P6-20 sweep was supposed to have finished, feeding a *scored* indicator worth 26 of the Risk Appetite pillar's 100 points. (b) That input's non-scraped path is `getAAIIBullish()` in `lib/unified-ai-fallback.ts`, which **asks an LLM for the number** (Grok → Groq → Anthropic → OpenAI) — a survey percentage is a published fact, not something to estimate, and the tier system labels it `ai-est` rather than refusing it. **(b) INVESTIGATED 2026-08-10 and it is far bigger than AAII — see P6-34. One piece fixed:** spot VIX now reads FRED `VIXCLS` from the store before the LLM chain, because the market-snapshot cron already writes it daily; `VIXCLS`/`VXVCLS` gain a 7-day staleness gate, and a store-sourced VIX is tiered `live`, not `ai-estimate`. (c) `lib/scraping-bee.tsx:268 scrapeAAIISentiment` is a third copy of the scrape, with the same two-independent-regexes pairing bug, ending in `"using baseline"`. (d) `app/api/panic-euphoria/route.ts:219` derives `aaiiBullish` from `investorIntelligence * 0.9` clamped to 25-65 — one of the five VIX-derived proxies already on the owner's decision list. | Fix (a) first: it is a scored input reading a constant. Then decide whether an LLM-estimated survey figure belongs in a scored pillar at all. **(a) FIXED (staging) 2026-08-10 — and it was worse than logged.** `generateCanarySignals` sits outside the pillar tier system exactly as the crash amplifiers did before P6-20, and held three `\|\| <const>` sites, not one. `notBaseline()` is hoisted to module scope and all three now skip when their input is baseline-tier. What the fix exposed is the ranking: **`buffettIndicator \|\| 180` sat ABOVE its own 150 threshold**, so a missing Buffett reading did not fail quietly — it pushed "Buffett Indicator at 180% - Above fair value" as a medium canary on every load, from no data. `shortInterest \|\| 2.5` fed a `< 2.5` test, landing exactly on the boundary. `aaiiBullish \|\| 35` sat below its 45 threshold and so never fired — the quiet one, and the reason nobody noticed the other two. **A constant that happens to be quiet is still a constant; the audit found this by grepping for the pattern, not by seeing a wrong number.** (b), (c) and (d) remain open. See also P6-32. |
| P6-32 | **P1** | **The other 31 canary inputs are still unguarded.** Fixing P6-31(a) meant reading `generateCanarySignals` properly, and the three `\|\| <const>` sites were only the ones a grep could see. The function reads **34 indicators straight off the assembly layer** and tier-checks exactly one of them (`fearGreedIndex`, guarded by P6-18). Every other input — `putCallRatio`, `spxPE`, `spxPS`, `qqqPE`, `mag7Concentration`, `shillerCAPE`, `equityRiskPremium`, `tedSpread`, `dxyIndex`, `ismPMI`, `fedFundsRate`, `fedReverseRepo`, `junkSpread`, `debtToGDP`, `yieldCurve`, `vix`, `vixTermStructure`, `nvidiaMomentum`, `soxIndex`, `qqqDailyReturn`, `qqqConsecDown`, and the eight `qqqBelow*` / `qqq*Proximity` pairs — is compared against a threshold with no idea whether it is a measurement or a fallback. These do not use the `\|\|` idiom, which is why the P6-20 sweep and this one both missed them: the constant is upstream, baked into `fetchWithAIFallback`'s baseline argument or the `\|\| 0` / `\|\| false` in the return assembly. **Canaries are the tab's headline warnings**, so this is the same class of defect as P6-20 on a larger surface. **FIXED (staging) 2026-08-10, same day.** `generateCanarySignals` moved to `lib/ccpi/canaries.ts`, where **every input is nullable and null produces no canary**. The module has no notion of provenance — the route resolves tiers with `notBaseline` before calling in, so the function cannot be handed a baseline constant unless the caller decides to lie to it. The four breach/proximity pairs (SMA20/50/200, Bollinger) share one gate each, because they share one source: half a reading is not a reading. Non-finite values are treated as missing, not as numbers. The response gains `suppressedCanaries[]`, naming every indicator that could not be evaluated — a short canary list and a short canary list with eleven suppressed inputs are very different states, and the payload could not previously distinguish them. `PILLAR_PCT` is a parameter rather than an import so the module stays import-free and loadable by a check script (the constraint that keeps `lib/ccpi/scoring.ts` and `lib/vix-term.ts` dependency-free). **30 checks in `scripts/check-ccpi-canaries.ts`; formulas suite 159 → 189.** The first one is the whole point: an entirely unavailable market produces zero warnings and names all 30 gates as suppressed. Two sweeps missed this defect by reading code; the property that catches it — null in, nothing out — is mechanical. | Every key already had a tier in `data.tiers` and the mapping was 1:1. Verified by the check suite, not at runtime: exercising this route offline means waiting out four AI-provider timeouts per indicator. |
| P6-34 | **P1** | **Eleven CCPI indicators ask an LLM to recall a published number, and the answers are scored.** `lib/unified-ai-fallback.ts` exports 14 getters, all built on the same chain: Grok → Groq → Anthropic → OpenAI → a hardcoded baseline. Eleven are consumed by `/api/ccpi`. **Every one of them is a fact somebody publishes** — Shiller CAPE, short interest, Mag7 concentration, QQQ P/E, the Buffett indicator, the CBOE put/call ratio, AAII bullish %, VIX, NVIDIA's share price, the SOX level, ISM PMI. An LLM does not know today's VIX or NVDA close; it produces a plausible number, and `isPlausible()` waves through anything inside a wide range (VIX: 5–100, so a hallucinated 22 is indistinguishable from a real one). The tier system then marks the result `ai-estimate`, and **`ai-estimate` is INCLUDED in pillar scoring** — only `baseline` is excluded and renormalised (P3-12). So a guess carries real weight in the headline crash index. Three of the eleven have a real source already wired elsewhere in the app: **VIX** (FRED VIXCLS, in the store — FIXED, see P6-31b), **NVIDIA price** (Alpha Vantage), **yield curve** (FRED DGS10/DGS2 via `lib/yield-curve.ts`). `getSPXPE`, `getFearGreed` and `getYieldCurve` are exported and never called — dead. **This is the last invented-data layer in the CCPI chain and the biggest single one.** **DECISION TAKEN 2026-08-10 (owner): exclude them.** `ai-estimate` no longer scores — `scorePillar` drops it exactly as it drops `baseline`, and the pillar renormalises over live weight only. Three consequences, all deliberate: (1) **certainty lost its `0.5 × aiMax` term.** Half-crediting a guess at a published figure was the same claim as scoring it, made quieter; certainty answers "how much of this is measured?" and the answer for an estimate is none of it. (2) **`aiMax` changed meaning** — it still accumulates, but now counts weight DROPPED for being AI-estimated. Reporting 0 would have read as "no AI estimates involved", the opposite of what happened. (3) **Three pieces of UI copy had to follow the arithmetic** or they would have kept making the old claim: the pillar provenance line, the data-source status panel, and the audit admin badge, which now reads "AI estimate — not scored" rather than implying a weaker-but-counted source. Formulas suite 189 → 190; two assertions in `check-ccpi-scoring.ts` pinned the *old* rule and were rewritten, which is the only reason the change was safe to make. **Cheap wins taken same day:** the three dead getters are gone — `getSPXPE`, `getFearGreed` and `getYieldCurve` were exported, never called, and each asked an LLM for a figure the site already sources (FMP/Apify, CNN, and FRED DGS10/DGS2 via `lib/yield-curve.ts`). Their baselines were 22.5, **50** and 0.25: on the Fear & Greed scale 50 is a real NEUTRAL reading, so the P6-18 defect was sitting dormant in a function nobody ran. Deleting them made nine per-provider fetchers dead, and those made **`lib/google-gemini-market-data.ts` dead in its entirety** — 136 lines, 15 exports, imported by nothing. Removed. **CLOSED 2026-08-10: `fetchWithAIFallback` no longer invents a constant.** The `baselineValue` parameter is gone; the chain returns `{ value: null, source: "unavailable" }` when no provider produces a plausible reading, and `aiTier` maps `"unavailable"` → `baseline`, which is excluded from scoring and suppressed from the canaries. Ten pillar inputs became `number | null` (`soxIndex`, `vix`, `putCallRatio`, `aaiiBullish`, `shortInterest`, `buffettIndicator`, `qqqPE`, `mag7Concentration`, `shillerCAPE`, `ismPMI`) and each point expression opens with `if (d.X === null) return null`. **That guard is belt-and-braces on purpose:** the tier and the value come from two different places in the assembly layer, and the entire P6-31/32 class was one of them being right while the other was not — so the scoring core now refuses a missing value even if a caller mislabels it `live`. Six assertions pin it, including "a single live input scores its own 29 weight but the pillar still refuses a number, because 29 < MIN_SCORED_MAX". Formulas 190 → **196**. **Still open (P3, cosmetic):** routing `nvidiaPrice` to Alpha Vantage. `nvidiaMomentum` — the *scored* input — is already tiered `baseline` when Alpha Vantage is down, so the LLM value only ever reaches a display field. | **Gotcha worth keeping:** the six new assertions were first appended to the END of `check-ccpi-scoring.ts`, below its `process.exit()`. The script still printed "All CCPI scoring checks passed" and the PASS count did not move. Same family as the `&&`-chaining gotcha: **a check that never runs is indistinguishable from one that passes.** Count the PASS lines after adding checks, not just after changing code. |
| P6-36 | **P1** | **Breadth counted SPY and QQQ as index constituents.** `compute_breadth` and `compute_breadth_range` (migrations 0006/0010) filtered by nothing — `market_closes` holds the two ETFs alongside the ~100 constituents (added in E-7c at zero API cost), so both were counted as members. **Invisible until 2026-08-10**, when a five-year closes backfill gave them a 200-day window: the daily run had said "99/100 qualified" for months and immediately reported **"102/100 qualified"** — more constituents than the universe contains. Worse than a miscount: **SPY and QQQ ARE the index**, so counting them in "what share of members hold above their own 200-day trend" is circular, and it biases breadth upward exactly when breadth matters — an index holding up while its members roll over is the divergence the CCPI redesign exists to detect. Second defect in the same functions: **`universe_size` was the caller's parameter, not a measurement.** It reported 100 regardless of what was there, so the one field that could have exposed the first defect was hardcoded to conceal it — the same shape as every invented constant this audit began with. **FIXED: migration 0012**, applied and verified. Both functions exclude the ETF set; `universe_size` is a measured `count(distinct ticker)`. Breadth history went 132 → **1,055 days** (2022-05-25 onward), sample 98-100 against a universe of 100, range 9.2-91.0% with the low on 2022-09-26/27/30 — about two weeks BEFORE the S&P's 2022-10-12 price low, which is lead time and better than the "October trough" first written here (corrected 2026-08-11 by running the query, see P6-70) — a plausible distribution, which is the evidence the computation is right rather than merely running. | `select * from compute_breadth_range()` — check `sample_size <= universe_size` on every row. |
| P6-37 | P2 | **Four silent truncation caps, all returning `ok: true`.** Found in one day, all the same shape: a caller asks for more than a hardcoded limit, the limit is applied silently, and the response reads as success. (a) `/api/cron/fred-snapshot` capped `backfill` at **800** — ~3 years of a daily series, when scoring 2008 needs ~6,300. (b) `getSeriesHistory` asked for 20,000 rows and **PostgREST returned 1,000** (`db-max-rows`, a server default nobody set) with no indication more existed — **this one cost an hour**: the first lead-time backtest scored a 44-year series using four years and reported confident hit rates from it. (c) `/api/cron/market-snapshot` capped `closesBackfill` at **320** and `fredBackfill` at 800. (d) `/api/cron/breadth` capped `backfill` at **320** — and that route computes breadth *backwards*, so it put a ceiling on how far the breadth-divergence signal could ever be backtested regardless of how much history was bought. **FIXED:** caps raised to match retention (9,000) and the FRED route (20,000); `getSeriesHistory` and the new breadth/close readers paginate; `/api/cron/breadth` now returns `backfillClamped {requested, applied}` rather than clamping in silence. **Swept the rest and deliberately left them:** the remaining `Math.min` clamps are on query endpoints (congress-trades days, insider windows, top-performers) where bounding a request loses no data and the caller is a UI with fixed controls. Those are product limits, not truncation bugs. **General rule: a limit that quietly clamps will be discovered by someone debugging the wrong thing.** | Any new `Math.min` on a caller-supplied depth must either refuse, or report what it applied. |
| P6-35 | **SUPERSEDED — DO NOT EXECUTE** | **Superseded 2026-08-10 by `CCPI_DESIGN.md`, which is APPROVED and shipped.** The step-by-step rescale below is preserved for its reasoning only; **do not carry it out.** It re-weights the existing indicator set, and the redesign's finding is that the set itself is wrong for the job — half the composite is coincident by construction, and §6b measured every free macro candidate and found none that earns weight at any horizon from 30 to 540 days. Rescaling weights inside a scoring model that has not demonstrated lead time would produce a more confident version of the same defect. The live consequence figures below (certainty ceilings 81 / 62 / 59, Risk Appetite going null without ScrapingBee) remain accurate and are still worth reading. Original text follows. — **89 of the CCPI's 400 weight points have no live source at all — and until today they were all being scored as AI estimates.** Derived from the weight tables and the tier assignments in `app/api/ccpi/route.ts`, not guessed: `shortInterest` (21), `qqqPE` (16), `mag7Concentration` (15), `ismPMI` (15), `shillerCAPE` (13) and `soxIndex` (9) have **no code path that can ever reach tier `live`** — the LLM chain is their only source. P6-34 correctly stopped scoring them, which means the honest consequences are now visible, and the owner should see them before UAT rather than after: **(a) certainty can never read 100.** Everything up, ScrapingBee included, tops out at **81**. **(b) Risk Appetite goes NULL whenever ScrapingBee is off** — `putCallRatio` (29) and `aaiiBullish` (26) are ScrapingBee-only, leaving CNN's Fear & Greed at 24, below the 40-point `MIN_SCORED_MAX`. That pillar is **30% of the composite** and simply drops out, leaving the index on Momentum + Valuation + Macro renormalised. **(c) Valuation lands on exactly 40** in that state — precisely at the threshold. One Apify/FMP hiccup takes it to 28 and it goes null too. **(d) Certainty with ScrapingBee off is 62** — verified by computation 2026-08-11, see P6-76 and `scripts/ccpi-certainty-ceiling.ts`. The "59 if Alpha Vantage is also down" figure is OBSOLETE: the VIX-derived put/call branch it depended on was deleted in P6-72, and the equivalent scenario (ScrapingBee and CNN both off) computes to 55. **Note also that 62 was never what production reported** — until 2026-08-11 two scrapers labelled LLM answers `live`, so the real figure was 79. This is not a regression; it is the first accurate reading of how much of the index is measured. But an index whose largest pillar vanishes when one scraper is disabled is a design question, not a bug report. **DECISION TAKEN 2026-08-10 (owner): drop all six from the weights**, as P3-10 did for `bullishPercent`/VXN/RVX/ATR/LTV. **NOT YET IMPLEMENTED — started and deliberately backed out**, because a half-applied rescale of the scoring core is worse than none and the session was out of room to finish it verified. Nothing was written; `check:formulas` still reads 201. **The next session should execute exactly this:**<br><br>**1. Weight tables** (each must still sum to 100; these are the surviving maxima rescaled ×100/remaining and rounded — already checked to sum correctly):<br>• `MOMENTUM` drop `soxIndex`; 9→10 nvidiaMomentum, 12→13 qqqDailyReturn, 7→8 qqqConsecDown, 7→8 qqqSMA20, 10→11 qqqSMA50, 15→16 qqqSMA200, 9→10 qqqBollinger, 13→14 vix, 9→10 vixTermStructure **= 100**<br>• `RISK_APPETITE` drop `shortInterest`; 29→37 putCallRatio, 24→30 fearGreedIndex, 26→33 aaiiBullish **= 100**<br>• `VALUATION` drop `qqqPE`, `mag7Concentration`, `shillerCAPE`; 18→32 spxPE, 12→21 spxPS, 16→29 buffettIndicator, 10→18 equityRiskPremium **= 100**<br>• `MACRO` drop `ismPMI`; 13→15 tedSpread, 12→14 dxyIndex, 15→18 fedFundsRate, 11→13 fedReverseRepo, 10→12 junkSpread, 10→12 debtToGDP, 14→16 yieldCurve **= 100**<br><br>**2. Rescale each surviving point expression.** Only ONE property has to be exact: **the top branch must return the new max.** `scorePillar` renormalises over `scoredMax`, and the suite's `max-risk pillar = 100` assertions verify precisely that, so intermediate branches can be any monotonic values. `smaPoints(below, prox, breach, near, approach)` call sites carry their points as arguments — scale those too.<br><br>**3. Remove the six keys** from the `*Key` unions, the `*Inputs` interfaces, the `points` objects, the `tiers` literal in `app/api/ccpi/route.ts`, and `CanaryInputs` + the `when(...)` blocks in `lib/ccpi/canaries.ts` (soxIndex and ismPMI have canaries; `INDICATOR_COUNT` in the canary check drops from 30). Also delete the now-unused getters in `lib/unified-ai-fallback.ts` (`getShortInterest`, `getQQQPE`, `getMag7Concentration`, `getShillerCAPE`, `getISMPMI`, `getSOXIndex`) and their per-provider fetchers, the way the last three were removed.<br><br>**4. Expect certainty to RISE**, not fall — that is the point of the change. Recompute the ceiling table afterwards and check it against the P6-35 figures above (81 / 62 / 59) so the improvement is measured rather than assumed. | Do NOT hand-verify the arithmetic: `check-ccpi-scoring.ts` asserts each pillar's weights sum to 100 and that a max-risk fixture scores exactly 100. Those two together catch every plausible slip in step 1 and 2. |
| P6-33 | P3 | **The SOX canary measures deviation from a hardcoded 5,000.** `((soxIndex - 5000) / 5000) * 100` — the reference level is a literal with no source, so "SOX down 12%" means "12% below 5,000", not 12% below anything the market did. It is now named `SOX_REFERENCE_LEVEL` in `lib/ccpi/canaries.ts` rather than buried, but naming a magic number does not source it. Distinct from P6-31/32: this is not a missing-data fallback, it is a threshold definition that pretends to be a measurement. **FIXED (staging) 2026-08-10 by relabelling — deriving a reference is not possible.** The semiconductor index is in neither FRED nor Polygon's grouped bars, so nothing the site stores can supply a trailing average; there is no moving baseline to compute. Naming the constant was not enough, because **the SENTENCE was the false claim**: "SOX down 12% - Chip sector crash" reads as a market move and actually meant "12% below 5,000". The canary now reads "SOX at 4200, 16.0% below the 5000 reference". The literal is `SOX_REFERENCE_LEVEL` in both `lib/ccpi/canaries.ts` and `lib/ccpi/scoring.ts` — duplicated because the canaries module must stay import-free — and a check asserts the two cannot drift apart. Formulas 196 → **201**. | **Found while fixing this, and it mattered more: `notBaseline` dropped only baseline-tier values, so P6-34 left an inconsistency the moment it landed** — the pillars stopped scoring AI estimates while the crash amplifiers and the headline canaries went on evaluating them. A warning could fire off a number the index itself refused to count. The helper is now `measured()` and drops `ai-estimate` too. |
| P6-38 | P2 | **Four Refresh buttons that refresh nothing.** Found doing the zero-mark tab sign-off. `exit-rules-dashboard.tsx`, `earnings-volatility-calculator.tsx` and `risk-reward-calculator.tsx` each rendered `<RefreshButton />` with **no handler at all**; `wheel-scanner.tsx` rendered `<RefreshButton onClick={() => {}} />`, which is worse, because it looks wired. `RefreshButton` calls `onClick \|\| onRefresh` and does nothing when neither exists — so all four painted an enabled emerald "Refresh", accepted the click, and returned no feedback of any kind. On three of those tabs there is genuinely nothing to refresh (every number is computed from the form, or is fixed reference copy); on the scanner the pipeline is four explicit user-run steps that each have their own button. **Same family as P6-24:** a control asserting a capability the code does not have, and from the user's side indistinguishable from a fetch that silently failed. **FIXED (staging):** all four removed, each with a comment saying why the header has no Refresh, so it does not get "restored" later as a missing feature. `federal-money-trail.tsx` keeps its Refresh — that one is wired to a real re-fetch with `isLoading`. | `grep -rn "RefreshButton" components/` — every surviving usage passes a handler. |
| P6-39 | P2 | **`exit-rules` presented hardcoded editorial copy under an "AI Insights" heading, with the site's Sparkles marker.** The section title read "AI Insights: Exit Strategy Psychology" above two accordion items whose text is a string literal in the JSX. Nothing was generated and no model was called. The site uses Sparkles as its AI marker elsewhere (`social-sentiment`'s AI Executive Summary is genuinely model-fed), so the icon is a claim, not decoration. Two smaller claims on the same tab: "These guidelines are based on backtested research showing the profit/loss targets that maximize long-term returns" and "Taking profits at 50% ... has been shown to increase long-term win rates" — both assert empirical results, neither has a source, and **this site does not run those backtests**. **FIXED (staging):** heading is now "Exit Strategy Psychology" with a neutral icon; both claims are restated as conventions with "not a result this site has measured" said plainly; the tab opens with a line stating every number on it is a fixed convention, not a live reading. Also dropped two dead `defaultValue` accordion keys (`automation`, `options-specific`) that had no matching items. **Not fixed, logged instead — same defect one tab over:** `insider-trading-dashboard.tsx:827` heads a hardcoded accordion "AI Insights: Insider Activity & Options Impact". That tab is already signed off on `data`/`api`/`err`, so it is a deliberate separate item rather than a quiet edit to a ticked row. **Actioned as P6-42 later the same day — and the section turned out to be fabricated, not merely mislabelled.** | Grep `AI Insights` and check whether the section below it comes from a fetch. Two of the four hits do not. |
| P6-40 | P3 | **`learn-leaps` taught a leverage range its own worked example broke.** "a deep ITM LEAPS gives roughly 3-5× the exposure per dollar of owning shares" — the example directly below buys $12,000 of stock exposure for $1,800, which is **6.7×**, outside the range the page had just stated. This is the third figure-vs-example mismatch on this one tab; the file's own comment records the previous two (the cost band was quoted as 18-25%, 20-30% and 15% in three places). The honest range is not an independent assertion at all: it is the inverse of the 15-30% cost band the page already teaches, i.e. ~3-7×. **FIXED (staging):** the line now derives the range from the cost band and says the example sits at the cheap end, so the two numbers cannot drift apart again. **Rule: a range and a worked example are two statements of the same fact — if the example is not inside the range, one of them is wrong, and the example is usually the true one.** | Re-verified all four `learn-*` payoff functions, breakevens, max profit/loss and every arithmetic claim in their walkthroughs against the code. `learn-csp`, `learn-cc` and `learn-pmcc` are exact. |
| P6-41 | P3 | **A static tab could never finish the sign-off ledger, so it looked permanently unaudited.** SITE_MAP §6 had two marks, ☑ and ☐. `exit-rules` and the four `learn-*` tabs have no API, no fallbacks and no error paths — nothing to verify in four of the eight columns — so a fully-audited static tab still rendered half-blank, which is exactly how an untouched tab renders. Same invisibility as P6-23: the record could not distinguish "checked, does not apply" from "nobody has looked". **FIXED:** a third mark `–` means *no such surface on this tab*, documented in the legend that `scripts/site-inventory.ts` generates. The ledger reader was already deliberately forgiving about cell characters, so no parser change was needed — proved by regenerating and diffing. | `pnpm inventory`, then check the five static rows still carry their `–`. Done: idempotent. |
| P6-42 | **P1** | **The insiders tab published fabricated trades attributed to named real people.** Following P6-39 into `insider-trading-dashboard.tsx`, the "AI Insights: Insider Activity & Options Impact" section was not merely mislabelled — its contents were invented. Hardcoded in the JSX: *"Multiple tech executives have executed significant sales **this week**. Tim Cook (AAPL), Jensen Huang (NVDA), and Mark Zuckerberg (META) have all reduced holdings through 10b5-1 plans"* and *"Sen. Tuberville increased LMT position while Rep. Gottheimer added XOM exposure"*. **No data backs either sentence** — they are string literals that rendered identically on every page load, on any date, naming identifiable individuals and asserting securities transactions they may not have made. The same section issued **strike-specific trade recommendations** as if derived from that flow — "AAPL: Bear put spread $220/$210", "NVDA: Long put $130 strike", "LMT: Bull call spread $520/$540", "XOM: Cash-secured put $105" — under a "Recommended Options Strategies" heading, plus an unsourced "IV typically rises 5-10% following large insider sales". Three `RunScenarioInAIDialog` buttons fed the invented details onward to the LLM as context. **This is the worst finding of the audit**: every earlier one presented a wrong or missing *number* as live; this presented invented *events about named people* as this week's news, and priced trades off them. **FIXED (staging): the entire section is deleted**, 128 lines, along with the imports it orphaned. Nothing was salvageable — every sentence was either fabricated or an unsourced recommendation. **The source of the fabrication was found two commits later and is P6-52 — `/api/insider-trading` seeded these exact people and tickers.** Fixing this prose alone would have left that intact; read the two together. **Nothing of value was lost:** the same tab already carries a genuine "AI Smart Analysis" card directly above it, which is data-driven, runs on an explicit button, operates on the trades actually fetched, and correctly labels its output as speculative hypotheses. The static section was a stale duplicate of a real feature. | Load the tab: the AI Smart Analysis card is empty until you press Generate, which is the honest state. Nothing now renders a named person's trade that did not come from a Form 4 fetch. |
| P6-43 | **P1** | **The Sell Put Scanner priced fabricated option premiums as live quotes, and sorted by them.** In `components/scanner/enrichment.ts`, when Polygon's chain-snapshot endpoint returns nothing, `useEstimatedGreeks` flips true and the scanner **synthesizes** the contract: delta from a moneyness cube, premium from `const estimatedIV = 0.35` — "Assume 35% IV as baseline" — and bid/ask as ±5% of that. Yield and annualized yield are then computed off the synthesized premium. The function tracked this in a local `priceSource`, set to `"estimated (market closed)"`, and **sent it nowhere but a `console.log`** — it was never attached to the row. So Step 4's results table rendered a fabricated premium in bold green, a delta to three decimals and both yield columns **exactly as it renders a real quote**, and `annualizedYield` is the table's default sort, so synthesized rows could rank at the top of a list the user picks trades from. **The label was also narrower than the trigger:** `useEstimatedGreeks` is set on *any* snapshot failure — rate limit, plan restriction, outage — not only a closed market, so this could fire mid-session on a trading day. Two defects compounding: P6-44's copy told the user the universe was options-qualified, so a ticker with no chain reached Step 4 and was handed a synthesized price rather than dropped. **FIXED (staging):** `priceSource` is a typed field on `QualifyingStock` (`last_quote` / `last_trade` / `day_data` / `synthesized`), set on the row and no longer only logged; `deltaSource` is set on the same path. Both result tables mark every synthesized premium, delta, yield and annual yield `est.` in amber, and the strict table's header states how many of its rows carry no live quote, names the three reasons it happens, says the 35% assumption out loud, and warns that sorting by yield ranks them against real quotes. `"estimated (market closed)"` is renamed `synthesized` because the old string named one of three triggers. | Run Step 4 outside market hours, or with `POLYGON_API_KEY` in `DISABLED_APIS`: every row should come back amber and marked, with the count in the header. Previously indistinguishable from a live scan. |
| P6-44 | P2 | **Step 2 promised an options-qualified universe that nothing qualifies.** The pre-filter card read *"All stocks are pre-qualified for active options markets."* `/api/polygon-tickers` contains exactly one occurrence of the word "options" and it is inside a comment describing intent. The universe is filtered on market cap, volume, price and daily range — **options availability is never queried**. On a put-selling scanner that is the one property the sentence should not have claimed without checking. Second claim in the same card: *"Top By Market Cap: Largest companies ... from S&P 500, Nasdaq-100, Dow indices"* described only the **fallback** path — `MAJOR_INDEX_TICKERS`, a hardcoded ~100-name list used when FMP and the grouped bars are both unavailable. The path that normally runs is FMP's screener across NYSE and Nasdaq, a different and far larger universe. So the card documented the degraded mode as if it were the normal one. **FIXED (staging):** both statements now describe what the code does, and the card says plainly that a missing chain surfaces at Step 4. **General rule: copy that describes a fallback path as the main path is not a wording problem — it means nobody has read the primary path recently.** | `grep -c options app/api/polygon-tickers/route.ts` → 1, in a comment. |
| P6-45 | **P1** | **The FOMC tab borrowed CME FedWatch's name for a heuristic that reads no futures.** Found sweeping for P6-42's shape. `/api/fomc-predictions` claimed, in four places, that its output comes from CME FedWatch methodology and Fed Funds futures pricing: *"Our prediction uses the CME FedWatch methodology, analyzing Fed Funds futures ... to calculate market-implied probabilities"*, *"Market Pricing: Implied rates from Fed Funds futures and Treasury markets"*, *"Similar to CME FedWatch Tool - calculates probabilities from market pricing of Fed Funds futures"*, and a link inviting side-by-side comparison. **The route reads no futures data of any kind.** FRED `DFF` is the *realized* effective overnight rate, not a curve. The probabilities come from `predictionScore` — a rule-based integer tally (`+2` if CPI > 3.5, `-2` if unemployment > 5.0, ±1 on trends, ±1 on GDP). The `weights` block was the same shape of claim: 40/30/15/15 percentages over a score that applies no weights, **one of them allocated to a "market pricing" input that does not exist**. Worst instance: the tab displayed **"Implied Rate"** with the tooltip *"The rate implied by Fed Funds futures markets. Represents what traders expect"* — the value is `currentRate + adjustedChange`, where the change is this site's own tally. In rates, "implied" means market-implied specifically, so the word itself was the false claim and no tooltip could undo it. The chart's forward line was captioned "Market consensus forecast calculated from Fed Funds futures" on the same basis. **FIXED (staging):** `weights` → `scoreContributions` describing the actual integer nudges; the methodology block states plainly that this is not the CME method and that CME is the one to trust when they disagree, rendered as an amber notice rather than buried in JSON; "Implied Rate" → **"Projected Rate"**; the chart caption separates the measured history from the projected forward line. **The heuristic itself is fine and its inputs are real, sourced and null-guarded (P6-16). What was not fine was wearing an exchange's name.** | `grep -niE "futures|fedwatch|cme" app/api/fomc-predictions/route.ts` — every surviving hit now says the route does NOT use them. |
| P6-46 | P2 | **"AI Trade Ideas & Adjustments This Week" on nine tabs, none of it AI, none of it weekly.** `components/options-strategy-toolbox.tsx` serves nine LEARN tabs (`wheel-strategy`, `credit-spreads`, `iron-condors`, `straddles-strangles`, `diagonals`, `calendar-spreads`, `butterflies`, `collars`). Its heading made three claims in six words — AI, current conditions, this week — over `config.insights`, a static object literal in the same file. No model runs, no market data is read, and the text is byte-for-byte identical on every load and every week. The tooltip doubled down: *"Our AI analyzes current market conditions and provides context for why these setups make sense now."* Same family as P6-39 and P6-42, and the **largest blast radius of the three** because one component carries it to nine tabs. **FIXED (staging):** retitled "How This Strategy Works & When to Adjust", tooltip restated as fixed educational reference that does not read live data. The content itself is good and was kept — only the claims about its provenance changed. | Nine tabs share one component; check any one of them. |
| P6-47 | P2 | **The CCPI still emitted options strategies after the owner ruled it should not — and named tickers it knows nothing about.** `19f4778` dropped the "Options Strategy Guide by CCPI Crash Risk Level" card "per the owner", but three sibling blocks inside the executive-summary narrative survived, each headed **"Recommended Strategies This Week"**. Two defects: (a) "This Week" promised a weekly refresh of what is a fixed list selected by CCPI band — the band is real, the freshness was not; (b) the low-risk block read *"Sell cash-secured puts on quality stocks (AAPL, MSFT, GOOGL)"* and *"Iron condors on SPY/QQQ with 30-45 DTE, target 70% POP"*. **The CCPI is a market-wide index — it reads nothing about any individual ticker**, so naming three was invented specificity of the P6-42 kind, and "70% POP" was a precise figure nothing computes. **FIXED (staging):** all three headed "What this regime generally favours", and the named tickers and the POP figure are gone; the bullets now describe the regime, which is the only thing the index actually measured. **RESOLVED same day — owner chose deletion**, matching the call he made on the sibling card. All three strategy lists are gone and the card is retitled "Current Regime". What survives is the regime sentence, every number in which is measured (band, active canary count, indicator total, certainty), plus one line stating that the index describes conditions and selects no trades. "Weekly Outlook" lost its "Weekly" too — the index refreshes on ISR, not on a week. | The branch selection is genuinely data-driven (`data.ccpi <= 39 / <= 59 / else`) — that part was never the defect. |
| P6-48 | P3 | **Two deterministic forecasters were labelled "AI-Powered", which oversells and undersells at once.** `/api/jobs-report` and `/api/fomc-predictions` import `NextResponse`, `getApiKey` and `fred-store` — no model, no provider, nothing to be powered by. Yet `jobs-report-dashboard.tsx` headlined *"AI-Powered Employment Forecasts & Analysis"* with a matching tooltip, and `fomc-predictions.tsx` said *"AI-powered predictions"*. **The direction of the error is worth noting:** every other finding in this family claimed more certainty than the code had; this one claimed a *guess* where the code does deterministic, sourced arithmetic on published series with missing inputs excluded rather than filled. It made honest work sound like a hallucination. **FIXED (staging):** both restated to what they are — trend-and-average over BLS series via FRED, and a rule-based score over FRED series. | Neither route imports any AI provider. `grep -rlE "anthropic\|openai\|groq\|unified-ai" app/api/jobs-report/ app/api/fomc-predictions/` → nothing. |
| P6-49 | P2 | **`scripts/check-provenance.ts` — the mechanical version of the sweep, and it found three defects on its first run.** The P6-38…P6-48 sweep was manual, which means it would have rotted within a release: nothing stopped the next component from claiming AI over a static literal. This script pins five rules, all derived from a defect that actually shipped. (1) **No `RefreshButton` without a working handler** — catches both `<RefreshButton />` and `onClick={() => {}}` (P6-38). (2) **Every AI claim in the UI must have a model behind it** — it resolves the `/api/...` paths a component fetches, loads those routes, and follows **one hop into `@/lib/`** before deciding; that hop exists because `/api/earnings-calendar/insights` reaches a provider only through `lib/earnings-calendar-ai.ts`, so a shallow check would have called a legitimate claim a lie (P6-39/42/46/48). (3) **No unqualified Fed Funds futures / FedWatch / market-implied claim**, with no allowlist — if a futures feed is ever bought, the honest way to re-enable the wording is to delete the rule in the same commit that wires the feed, which forces claim and capability to land together (P6-45). (4) **Seven retired phrases stay retired**, pinned by exact string with the finding number as the reason, because each is one copy-paste from an old component away from returning. (5) **A synthesized price stays distinguishable from a quoted one** (P6-43). **Comments are stripped before matching, deliberately** — every fix in this batch left the false string in a comment explaining why it was wrong, and a checker that could not tell those apart would fail on its own documentation. **14 checks; formulas suite 422 → 436.** | The PASS count moving 422 → 436 is the evidence it runs at all — see the P6-34 gotcha, where six new assertions sat below a `process.exit()` and the suite happily reported success. |
| P6-50 | P2 | **Three more false AI labels, all found by the new check rather than by reading.** (a) `components/greeks-calculator.tsx` — a **fifth** handler-less Refresh button, `onClick={() => {}}`, missed by the P6-38 sweep because that pass grepped for the bare `<RefreshButton />` form and only caught the scanner's empty-handler variant by eye. (b) `components/risk-reward-calculator.tsx` — "This is an **AI-generated** recommendation based on your trade's risk/reward profile", above a four-branch `if/else` on `annualizedROI` in the same file. (c) `app/page.tsx` footer — "This website and its free **AI-powered** tools (including calculators, predictions, and analyses)", **two clauses before the same sentence correctly says the content is "based on algorithms, formulas, and third-party data"**. The disclaimer contradicted itself inside one paragraph, and the accurate half was already there. All three fixed. | The check found in one run what a careful manual pass had missed three times over, which is the argument for having it. |
| P6-51 | **P1** | **The site's most prominent claim described the version of the CCPI it had just deliberately stopped being.** `app/page.tsx` nav metadata called the flagship tab an *"**AI-powered** crash probability model"* — the first sentence a user reads about the index. **P6-34 removed AI estimates from CCPI scoring entirely** (decision taken by the owner 2026-08-10): `scorePillar` drops `ai-estimate` exactly as it drops `baseline`, and pillars renormalise over live weight only. So the score is, by design and by shipped code, computed from measured readings and nothing else. An LLM does write the executive summary that narrates the score, and that card correctly says "Generated by Grok xAI" where it appears — but nothing a model produced carries any weight in the number. **This is the mirror image of every other finding in the batch**: not a label overstating what the code does, but a label that went stale when the code got *more* honest and nobody updated the shop window. **FIXED (staging):** the tooltip now says only measured readings are scored and that estimated inputs are excluded and renormalised — which is both true and the better selling point. **Rule: a claim has to be re-read when the thing it describes improves, not only when it breaks.** Nothing in the audit was looking for that direction. | Caught by check-provenance rule 2 — `app/page.tsx` makes an AI claim and fetches no route that reaches a model. |
| P6-52 | **P1** | **`/api/insider-trading` served seven invented Form 4 and STOCK Act filings, at HTTP 200, whenever every live source failed — and this is where P6-42 came from.** `getSeedTransactions()` returned named real people with share counts, prices and dates: *"Cook Timothy D, CEO, AAPL, -100,000 shares, $220.00, $22M, Routine divestiture"*, and the same shape for Jensen Huang (NVDA), Mark Zuckerberg (META), Nancy Pelosi (MSFT), Tommy Tuberville (LMT), Josh Gottheimer (XOM). **The hardcoded prose deleted in P6-42 named exactly these people and tickers** — it was written to narrate the seed rows, so a fabrication in the data layer had propagated into prose asserting the trades happened "this week". Fixing the prose without this would have left the source intact. Three separate house-rule violations: (a) the catch path returned **`success: true` with a fresh `lastUpdated` timestamp** and the invented rows — "Error responses use real HTTP error statuses, never 200 with an `{error}` body"; (b) its `dataSources` counts on that path were **hardcoded 4 and 3**, describing the seed rather than anything measured; (c) the UI's status line rendered "**Data unavailable (4 trades)**" — a contradiction visible on screen, both halves from the same response — directly above four rendered transactions. **FIXED (staging): the seed is deleted.** All-sources-empty returns **503**, an exception returns **502**, both with `transactions: []`. The dashboard clears its table on either and shows "No filings retrieved… this page does not fall back to placeholder trades" — it previously kept the last good result on a failed refresh, which under a changed ticker or window attributed real filings to a window they did not come from. | Found by rule 6 of `check-provenance.ts` on the run that added it — "no API route ships a hardcoded ticker with a hardcoded price". A grep for the *prose* had already cleared this file. |
| P6-53 | **P1** | **`/api/strategy-scanner`'s POST returned three invented trade setups, and a component stamped them "Last scanned".** The handler said what it was doing in its own comment — *"Since AI functionality is not used, we return default setups"* — then returned SPY 595/590 for $2.35 at 72% POP, QQQ 510/505 for $2.10 at 70%, IWM 235/230 for $1.85 at 68%, at **HTTP 200**. Above it sat an unused prompt template opening *"Based on current market conditions (late November 2025, VIX around 18-22, markets near all-time highs)"* with price anchors — SPY ~$595, NVDA ~$145 — so the invented numbers were stale as well as fabricated. **The damage was in the interaction, not the payload.** `options-strategy-toolbox` renders `config.setups` by default and labels them honestly: "illustrative teaching examples — not live trade recommendations". Pressing Scan replaced that labelled set with these, and stamped **"Last scanned: 14:32"** beside them. The refresh made the page less truthful than it was at rest, and the timestamp is what sold it — an illustration wearing a scan time reads as a result. **Nine LEARN tabs share that component.** **FIXED (staging):** the route returns **501** with an explicit "this site does not scan for specific trade setups"; the Scan button, the `setups`/`isScanning`/`lastScanned` state, the "Last scanned" line and the "AI Scanning Markets…" badge are all gone. The page now shows only its labelled examples, which is the honest resting state it already had. Also corrected: the header tooltip claimed the page teaches "with real-time market examples". | Same check rule as P6-52. Two routes, same defect, neither reachable by grepping prose. |
| P6-54 | P2 | **Two sliders the user could drag with no effect, above a tooltip explaining a column that renders "not measured" on every row.** An earlier pass correctly found `historicalVolatility` and `priceStability` were restatements of beta wearing the names of independent measurements — stability was literally `100 - beta*20 - HV*0.5`, and HV was itself derived from beta — and set both to `null` in `/api/strategy-scanner`. It stopped there. `calendar-spread-scanner` kept both sliders: "Max HV" (10–60) and "Min Stability" (50–95), filtering on `x !== null && …`, which is never true. The Min Stability tooltip still defined the score as "what percentage of the last 30 days the stock stayed within a tight trading range" — a definition the deleted computation never implemented — and advised "Look for 75% or higher". **Same family as the handler-less Refresh buttons (P6-38): a control that accepts input and does nothing.** It is the predictable second half of withholding a value, and it survived because removing a computation looks finished the moment the number stops being wrong. **FIXED (staging):** both sliders, their state and their dead filter lines are gone. Beta remains filterable, and it is the real measurement the other two were paraphrasing. | Found by rule 7, which pairs `const X = null` in a route against any `min<X>`/`max<X>` control in the UI. |
| P6-55 | P3 | **`check-provenance.ts` extended from nouns to numbers — 14 → 18 checks, formulas 436 → 440.** Three new rules, each generalising a defect rather than pinning its instance. **Rule 6, no API route ships a hardcoded ticker with a hardcoded price** — a route's job is to fetch or compute, so a literal symbol beside a literal price is either fabricated output or a prompt anchoring a model to stale prices; the strategy-scanner had both. Components are exempt, because labelled teaching examples belong there. **Rule 7, no UI control filters on a value the route hardcodes to null** — it collects every `const X = null` in `app/api/**` and fails on any `min<X>`/`max<X>` state in a component. **Rule 8, a provenance field must be read, not merely declared** — `deltaSource` had existed on `QualifyingStock` since the Phase 4 split with no consumer, which is precisely how `priceSource` came to be computed and thrown away (P6-43). Both result tables now key the delta column off `deltaSource` rather than borrowing `priceSource`; they resolve identically today, but a field nothing reads is indistinguishable from no field at all. **Rules 6 and 7 each found a live P1 or P2 on the run that introduced them** (P6-52, P6-53, P6-54). | Formulas 436 → 440 is the evidence the new rules run — see the P6-34 gotcha, where new assertions below a `process.exit()` were invisible. |
| P6-56 | **P1** | **Nine routes returned a failure at HTTP 200, and three said so in a comment.** `CLAUDE.md` has carried "Error responses use real HTTP error statuses — never 200 with an `{error}` body" since the audit began. A sweep for the behavioural signature — a JSON response admitting failure with no error status — found it in nine places, and the comments beside three of them show it was deliberate each time: *"Changed from 500 to 200 to prevent error bubbling"*, *"Return 200 with empty arrays instead of 500"*, *"Return 200 with error flag so the calling function can handle fallback"*. **Each was a real status downgraded to stop something downstream complaining.** The cost is that "we found nothing" and "we never looked" become the same response on the wire: seven scanner tabs render an empty array as "no candidates found", so a total outage read as a quiet market. **The worst one was live-facing.** `/api/ccpi/executive-summary` returned, at 200, a `summary` reading *"CCPI analysis is currently being generated. The market data has been successfully loaded."* — false twice, since every provider had already failed and nothing was still generating. It landed in the field the dashboard renders as the executive summary, **beneath a line reading "Generated by Grok xAI"**, so a failure produced a reassuring sentence with a model's byline. The dashboard's own catch then set a second such sentence, which got the same byline. **FIXED (staging):** executive-summary returns 503 with no summary and the dashboard sets null; `/api/insider-clusters` (three sites), `/api/scraping-bee` (two, one outside any catch), `/api/strategy-scanner` GET and `/api/smart-money-etfs` (no status argument at all, which Next serves as 200) now return 502/503. All eight scanner consumers were verified to check `res.ok` first. **`/api/earnings-calendar` was deliberately left at 200 with `success: true`** — its economic half is real (derived from publication rules and the committed FOMC schedule) and does not need the feed that failed, so it is a PARTIAL success and reports the failed half in its own `earningsError` field, exactly as `/api/federal-money` does. The defect there was never the boolean: it was `earnings: "Static Fallback"` beside an empty array, naming a fallback that does not exist and leaving an outage indistinguishable from a quiet week. The tab now says which it is. | Rule 9 of `check-provenance.ts`. **`/api/time-server` is deliberately not flagged** — it falls back to server time with `fallback: true`, and server time IS a time. Honest degradation is not this defect. |
| P6-57 | P3 | **Rule 9, and three false starts worth recording, because each is how a check gets deleted rather than fixed.** (a) The first version matched `\berror:` and fired inside `console.error("… API error:", error)` — a correct route failing its own check. Keys must be matched at object-property position, `[{,]\s*error:`. (b) The second walked only `catch` blocks; the very next 200-on-error found sat in an ordinary `if (!response.ok)` branch, so the rule is now scoped to the response call, not the enclosing block — the defect has nothing to do with exceptions. (c) The third treated any non-literal status as suspect and flagged five correct routes passing `{ status: response.status }` or `{ status: contractsResult.httpStatus }` — **which is the better pattern**, since it forwards the upstream's own verdict instead of inventing one. Three states, not two: a literal 4xx/5xx passes, a computed status passes, and only a literal 200 or a missing status argument fails. **A check that cries wolf on correct code is worse than no check**, because the next person to see it red deletes it. All three were caught by running the rule against a codebase whose correct cases were already known — write the rule, then look hard at what it accuses. | Provenance suite 18 → 19; formulas 440 → 441. |
| P6-58 | **P1** | **The Fear & Greed substitute invented two of its seven components, and one of them restated a third.** Attacking limit 3 — unsourced prose — meant inventorying every world-claim in JSX. Twenty candidates; nineteen were concept explanations or the audit's own "not currently measured" disclosures. The twentieth was `market-sentiment`'s fallback banner, and following it into the route found this. When CNN is unreachable, `calculateFallbackIndex` builds seven equal-weighted components, and **when the NYSE highs/lows scrape is also down it synthesizes them from SPY momentum**: `nyseHighs = 150 + spyMomentum * 10`, `nyseLows = 80 - spyMomentum * 5`. Those feed "Stock Price Strength" — while "Market Momentum" is `(SPY − 125-day MA) / 125-day MA`, the *same* measurement. **Two of seven components were one number**, and the equal-weight mean therefore double-counted it. The starting constants were themselves readings: 150/80 with momentum flat scores **65 — Greed, from no data** — and a second default pair further up the file (`nyseLows = 100, nyseHighs = 50`) scores **33, Fear**, from the same absence. Two invented defaults in one file pointing opposite ways. On top of that, two components fell back to a literal **50** on a missing moving average and were counted in the `/7` — which is the P6-18 defect precisely, since on a 0-100 fear scale 50 is a real NEUTRAL reading, not an absence. **These survived the P6-18 sweep on this very tab** because that sweep grepped `\|\| 50` and these are `let x = 150` assignments — the same reason P6-32's 34 unguarded inputs were missed. **FIXED (staging):** highs/lows are `number \| null` and never approximated; each component is nullable; missing components are excluded and named in `excludedComponents`; the mean renormalises over what was measured; and **fewer than four of seven refuses to publish a number at all**, because a fragment of an index is not the index. | The P6-22 UAT note recorded "4 of 7 components real, 3 honestly NO DATA" — that was the CNN-scrape path. Nobody had exercised the calculated path, which is what runs when CNN is down. |
| P6-59 | P2 | **"The same 7-indicator methodology … values may differ slightly … follow the same formula."** The banner shown whenever the CNN scrape fails. The **aggregation** genuinely matches CNN's — seven named components, equal weight — but the inputs do not, and one of them is not the component it is named after: **"Put and Call Options" is computed from VIX against its 50-day MA** (`calculatePutCallRatio(vixCurrent, vix50DayMA)`), so it is a second volatility reading wearing an options ratio's name, and it shares both inputs with "Market Volatility". CNN's component of that name is an actual put/call ratio. **"Values may differ slightly" was unsupported in the same breath** — with components droppable and Stock Price Strength previously synthesized from SPY, the gap has no bound. This is P6-45's move exactly: borrowing an institution's methodology because the arithmetic resembled it. **FIXED (staging):** the banner now says the reading borrows CNN's component names and weighting but computes its own inputs, names the put/call substitution outright, states that components with no data are excluded, and tells the reader to expect more than a rounding difference — "a second opinion, not a substitute". The route's `methodology` field says the same thing instead of "CNN Fear & Greed Index methodology". **Noted, not fixed:** `calculateMarketVolatility` takes `vix50DayMA` and never uses it — its body is a pure VIX-level map — so its comment describes a calculation the function does not perform. | Rule 10 now pins the new banner to `excludedComponents` surviving in the route. |
| P6-60 | P2 | **Rule 10: a claim that rests on a decision is pinned to that decision's code — the first rule here that runs backwards.** Every other rule catches a claim overstating what the code does. **P6-51 was the reverse**: the homepage's "AI-powered crash probability model" was TRUE when written, and P6-34 falsified it by removing `ai-estimate` from pillar scoring. The index got more honest and the sentence rotted, untouched, unnoticed for a day. Nothing on this project compared a sentence against the decision it depends on. The registry names a claim, the file it lives in, and a fact about the code that must remain true — and **fails in both directions**: if the dependency breaks the claim is stale, and *if the claim text is edited or removed the entry itself is stale* and must be pruned. The second half is deliberate: a registry nobody prunes is the same rotting record as the sign-off ledger `pnpm inventory` used to erase (P6-23). Four claims seeded — the CCPI scoring description (P6-34), the scanner's "fixed 35%" banner (P6-43), the FOMC "NOT a market-implied rate" disclaimer (P6-45), and Fear & Greed's exclusion promise (P6-58). **Verified by breaking it:** deleting `\|\| tier === "ai-estimate"` from `scorePillar` turns the P6-34 row red, then restoring it turns it green. A pin that has never been seen to fail is not known to be a pin. | Provenance suite 19 → 23; formulas 441 → 445. |
| P6-61 | **P1** | **Panic/Euphoria double-counted VIX through two differently-named components.** Auditing the other composites for P6-58's shape — components that restate each other inside an equal-weight mean — found it immediately. `investorIntelligence = 100 − ((VIX − 10) / 40) × 60`, and directly beneath it `aaiiBullish = investorIntelligence * 0.9`. **The second is a scalar multiple of the first.** It cannot disagree with it at any VIX level, ever, and both were scored and both entered `componentScores`, a plain mean over up to nine components. So VIX level carried **2/9 of the composite through two components that read as independent evidence** — and more than that whenever a FRED series was unavailable and the divisor shrank. The route's `syntheticComponents` array already listed both as proxies, and **that is a different fact which did not cover this one**: a reader can accept two labelled proxies as two pieces of evidence, which is exactly what they are not. Third instance of one defect — P6-54 (price stability restating beta), P6-58 (NYSE highs/lows restating SPY momentum), and now this. **The test that finds it: can component A ever disagree with component B?** If B = f(A) with f monotonic, the answer is no and B is not an input. **FIXED (staging):** `aaiiScore` is gone from the composite; `aaiiBullish` remains as a display field. The VIX components that survive are `investorIntelligence` (level) and `putCallRatio` (5-day vs 50-day term structure), which genuinely can disagree. | **The CCPI pillars were checked for the same defect and are clean** — no scalar-multiple derivations. Momentum's six QQQ inputs are correlated but not restatements: SMA20 and SMA200 can and do disagree, which is the property that matters. |
| P6-62 | **P1** | **Two Panic/Euphoria tooltips named real weekly surveys as their SOURCE for numbers computed from VIX.** Found in the same pass. The Investor Intelligence row read *"SOURCE: Investor Intelligence weekly survey data"* — the value is `100 − ((VIX − 10) / 40) × 60`. The AAII row read *"SOURCE: Weekly AAII sentiment survey"* — the value is the row above times 0.9. **Neither survey is consulted anywhere in the codebase.** Naming a specific named publication as the origin of a number is the strongest provenance claim a tooltip can make, and both were false. This is P6-45's move (borrowing CME FedWatch) and P6-59's (borrowing CNN's methodology), and it is worse than either because a survey has an author. The payload's `syntheticComponents` flag contradicted the tooltips in the same response — **and users read tooltips, not JSON**. **FIXED (staging):** both tooltips now state the derivation explicitly, name VIX as the source, keep the contrarian interpretation with the caveat that it is "VIX wearing a survey's name", and the AAII row opens "DISPLAY ONLY — not scored" so the exclusion in P6-61 is visible where the number is. | Note the pattern across P6-45, P6-59 and P6-62: three separate tabs each borrowed an institution's name because the OUTPUT resembled that institution's output. Nobody checked the input. |
| P6-63 | P2 | **The pinned-claim registry grew from four claims to eight, and both negative pins were verified by breaking them.** Rule 10 (P6-60) protected a sample; this walks the recorded owner decisions and registers the UI copy that depends on each. Added: **P6-47** — the CCPI's "It does not select trades" is pinned to the per-band strategy lists staying deleted; **P6-53** — the toolbox's "they do not update with the market" is pinned to `/api/strategy-scanner` still answering 501; **P6-61** — Panic/Euphoria's "DISPLAY ONLY — not scored" is pinned to `aaiiScore` staying out of the composite. **Two bugs found in the rule while writing them.** (a) The P6-47 pin was `/^(?!.*Recommended Strategies)[\s\S]*$/` — with `.` and no `s` flag the lookahead covers only the first line, so it would have passed vacuously forever. `[\s\S]` throughout. (b) The P6-61 pin first keyed off a marker in a `//` comment, which `code()` strips before matching — a dependency that cannot survive the reader is not a dependency. Both are now negative pins over executable source. **Each was verified by breaking the thing it guards and watching it turn red**, then restoring: injecting "Recommended Strategies This Week" into the CCPI heading fires both rule 4 and rule 10; putting `aaiiScore` back into `componentScores` fires P6-61. **A pin that has never been seen to fail is not known to be a pin** — and two of these would not have failed for real reasons. | Provenance suite 23 → 26; formulas 445 → 448. |
| P6-64 | P3 | **Process gotcha that cost real time today: `git checkout -- <file>` was used to undo a deliberate break during pin verification, and it discarded uncommitted work in the same file.** The P6-61 fix — removing `aaiiScore` from the composite — was not yet committed when the file was reverted to prove the pin fired. The fix was silently gone and had to be redone from scratch; only a `grep` afterwards revealed it. **When verifying a check by breaking something, copy the file to the scratchpad first and restore from that copy**, never from git, unless the work is already committed. The same reasoning as every other finding here: `git checkout --` LOOKS like an undo of the last edit and is actually an undo of everything since the last commit. | Redone and verified. The remaining verifications in this session used scratchpad backups. |
| P6-65 | P2 | **Social Sentiment fetched the identical Finnhub URL twice and presented the two scorings as two of its six sources.** `getFinnhubSentiment()` and `getNewsFearGreed()` each issued their own request to `finnhub.io/api/v1/news?category=general` — byte-identical endpoint, identical seven-day window — then scored the same article list two different ways: headline tone over the top 50, and greed/fear word counts over the top 30. Both entered the weighted composite as their own indicator, **0.11 + 0.08 = 0.19 of the weight on one corpus**, and the second was named "News Fear & Greed", a name that conceals that it IS Finnhub's general feed. The source list showed six sources over five corpora. Two HTTP calls per request against a metered free tier for one article list, on a site with a hard $79/mo cap and a budget guard. **Milder than P6-61 and worth saying so:** these are not scalar multiples and can genuinely disagree, because the lenses differ. But two readings of one article set are two opinions, not two witnesses. **FIXED (staging):** one `fetchFinnhubGeneralNews()` call, both lenses derived from its result, and the "News Fear & Greed" description now states outright that it reads the same feed as the row above — "a second lens, not a second source". **Left for the owner:** whether 0.19 of the composite weight should rest on one corpus at all. Weight changes are owner decisions here (P3-10, P6-34, P6-35), so the arithmetic is unchanged and only the honesty is fixed. | Found auditing the remaining composites for P6-61's shape. **`getPolygonNewsSentiment` was accidentally deleted while restructuring and restored from HEAD** — the function inventory was diffed against HEAD afterwards to confirm nothing else went with it. |
| P6-66 | P3 | **`calculateMomentumStrength` returns exactly 50 when nothing contributed, and that 50 is published as `confidence` and scales the price targets.** In `/api/trend-analysis` the function opens `let strength = 50 // neutral baseline` and adds four contributions: RSI (±20), MACD (±15), 20-day price change (±10), volume trend (±5). Each contributes **0** when its input is missing — RSI and MACD null on short history, price change guarded to 0 below 20 bars, volume trend 0 on empty volumes. With all four absent the function returns **50**, which is not "unknown" on this scale but a real NEUTRAL momentum reading. It then becomes `confidence: momentumStrength` in the response and multiplies the one-week target: `currentPrice + atr * 2 * (momentumStrength / 50)`. **Same family as P6-18 and P6-58's neutral-50, and the third place this shape has appeared.** **RESOLVED 2026-08-11 — see the P6-66 FIXED row directly below, which supersedes this paragraph.** It was deferred at first, and the reason still stands as a record of the judgement:  it is latent, not live — reaching it needs a symbol with fewer than 20 bars, and the route reads major indices, which always have history. Fixing it properly means making `momentumStrength` nullable and following it through `determineTrend`, the confidence field and the target arithmetic. **A half-applied change to a scoring core is worse than none** (the P6-35 precedent), and this was found at the end of a long session. The next session should make the strength null when no contribution fired, and let confidence and targets decline rather than default. | The four contributions were also checked for P6-61's redundancy and are **clean**: RSI, MACD and 20-day ROC are all momentum measures and heavily correlated, but none is a function of another — a choppy tape gives RSI near 50 with a large ROC, and they routinely disagree. |
| P6-67 | P3 | **Composite independence audit — the full result, including what came back clean.** Recording the negatives so nobody re-runs this. The question asked of every pair in every composite: **can A ever disagree with B?** If B = f(A) with f monotonic, B carries no information and is not an input. **DEFECTIVE:** `panic-euphoria` (P6-61 — `aaiiBullish = investorIntelligence * 0.9`, both scored); `market-sentiment` (P6-58 — NYSE highs/lows synthesized from SPY momentum, feeding a component alongside SPY momentum itself); `calendar-spread-scanner` (P6-54 — price stability was `100 − beta*20 − HV*0.5`, and HV was itself beta-derived); `social-sentiment` (P6-65 — one corpus, two indicators, the milder version). **CLEAN:** the four CCPI pillars — Momentum's six QQQ inputs are correlated but SMA20 and SMA200 routinely disagree, and `vix` vs `vixTermStructure` is level vs shape; `trend-analysis`'s four momentum contributions, for the same reason. **The pattern in the four defects: every one arose from a fallback.** Nobody set out to double-count. Someone needed a number a source could not supply, derived it from a number they had, gave it the missing thing's name, and the composite then treated the derivation as evidence. **A proxy is a label problem until it enters an average — then it is an arithmetic problem.** | No check can enforce this; it needs the pairwise question asked by hand. See the eighth limit in the pre-Phase-7 list. |
| P6-66 **FIXED** (was logged-only) | P2 | **Momentum strength is nullable end to end, and the fix found three more neutral-50 sites on the way out.** The deferred change from the composite audit, done properly. `calculateMomentumStrength` opened at a 50 baseline and added four contributions, each of which silently contributed 0 when its input was missing — so with RSI null, MACD null, under 20 bars and no volume history it returned **exactly 50**, a real NEUTRAL momentum reading manufactured from nothing. It now tracks whether any input actually moved the baseline and returns **null** when none did. Threading that through found the rest of the defect, which was never confined to one function: **(a)** `determineTrend` voted on momentum unconditionally; it now abstains on null while keeping its 2 points in the denominator, matching how RSI and MACD were already handled. **(b)** `calculatePriceTargets` computed `target1Week = currentPrice + atr * 2 * (momentumStrength / 50)` — with momentum unknown that formula has no value, so the weekly target is withheld; the monthly target and stop are structural (support/resistance/ATR) and survive. **(c)** Its Neutral branch returned a **hardcoded `confidence: 50`** having never consulted momentum at all — a constant dressed as a measurement, in a field named confidence. **(d)** `priceChange` and `volumeTrend` were `: 0` on their unavailable branches and rendered in the breakdown as `value: 0` — a 20-day price change of exactly 0.00% and a flat volume trend, stated as measurements when the bars to compute them did not exist. **Three of those four were not in the original finding.** | Formulas 448 → 449 with the new pin. |
| P6-68 | **P1** | **The UI re-created the defect the route had just been fixed for — including a $0.00 price target.** Making the route honest is only half of it, and this half was worse. `components/trend-analysis.tsx` carried `momentumStrength ?? 50` in two places, so a null reading **parked the gauge needle dead-centre and labelled it "Neutral"** — the identical defect, one layer up, and invisible from the route. The momentum-strength tile did the same. The loudest one was the 1-Week Target card: `${(selectedItem.priceTarget1Week ?? 0).toFixed(2)}` printed **"$0.00"** in the same bold green as a real target, with a percentage move computed against it. A plausible-looking wrong number is dangerous; a $0.00 price target is nonsense wearing the styling of a measurement. **FIXED:** the gauge shows "No momentum reading — not enough price history" instead of a needle, the tile shows an em-dash, and the target card explains that the weekly target is absent because momentum is, and that the monthly target and stop are unaffected. The four duplicated contribution cards collapsed into one null-aware `ContributionCard`, which renders "no data" rather than "+0.0 pts" — **a contribution of exactly zero and an absent contribution are different facts and looked identical.** | **General rule earned: `?? <neutral>` in a component is the same defect as `\|\| <const>` in a route, and no sweep of this audit had ever looked at the component side.** The route-side sweeps (P6-18, P6-20, P6-32) all stopped at the API boundary. |
| P6-69 | P2 | **P6-37's fix was half-applied, and only running its own verification found it.** That row records the resolution as "caps raised to match retention … and `/api/cron/breadth` now returns `backfillClamped {requested, applied}` rather than clamping in silence". **Only breadth got the second half.** `/api/cron/fred-snapshot` and `/api/cron/market-snapshot` (two clamps) had their ceilings raised — 800 → 20,000 and 320 → 9,000 — and went on clamping without a word. **That is the same defect at a higher number:** asking for 30,000 rows and receiving 20,000 with `ok: true` still reads as "that is all there was", which is precisely how the first lead-time backtest came to score a 44-year series using four years. A raised ceiling is not a visible one. **FIXED (staging):** both routes split the requested value from the applied one and emit `backfillClamped` on the same shape breadth already used. **Rule 11 added to `check-provenance.ts`:** in `app/api/cron/**`, a `Math.min` on a caller-supplied backfill must be accompanied by a `backfillClamped` report in the same file — verified by renaming the field and watching it go red. **The query-endpoint clamps stay untouched and unchecked, deliberately** — P6-37 already ruled that bounding congress-trades days or an insider window loses no data and is a product limit, not truncation. | Formulas 449 → 450. |
| P6-70 | P2 | **P6-36 verified live against the database, and its recorded evidence was slightly wrong.** The breadth fix (migration 0012, ETFs excluded and `universe_size` measured rather than echoed from the caller's parameter) is confirmed: `select * from compute_breadth_range()` returns **1,055 rows, 2022-05-25 → 2026-08-10, zero rows where `sample_size > universe_size`**, sample 98-100 against a measured universe of exactly 100 — while `market_closes` holds **102 distinct tickers, two of which are SPY and QQQ**. The exclusion works and the universe is a count, not a constant. **One correction to the record:** the row claims the range low lands "in the October 2022 trough". It does not — the minimum is **9.2% on 2022-09-26, -27 and -30**, roughly two weeks before the S&P's 2022-10-12 price low. **This is a better result than the one recorded, not a worse one:** breadth bottoming ahead of price is lead time, and lead time is the entire property the CCPI redesign is waiting on (§6b). It should not have been written down as October without looking. | Corrected in P6-36's row. **General point: a verification note that was never run is a claim, not evidence** — this one sat in the backlog for a day reading as though it had been checked. |
| P6-71 | **P1** | **The component-side sweep P6-68 called for — 37 sites, three live defects, and two of them were misses from my own P6-68 fix.** Every `\|\| <const>` sweep this audit ran (P6-18, P6-20, P6-32) stopped at the API boundary, so 95 components had never been examined for the same defect in its component idiom. **Live: (a)** two `momentumStrength ?? 0` sites in `trend-analysis` that the P6-68 pass missed while fixing the gauge and the tile — they render **"0/100"**, the bottom of the scale, for an absent reading. **(b)** `panic-euphoria`'s `componentScores?.X ?? 0` on a −1..+1 scale parked the score bar on the exact midpoint for a null score; **the tooltip documented the behaviour** — "the score bar reads 0.00 until 8 days accumulate" — which is a label describing an arithmetic problem instead of fixing it, the P6-67 pattern exactly. **(c)** `qqqSMA*Proximity \|\| 0` fed a CCPI gradient bar whose own scale labels 0 **"Safe: 0% (far above)"**, so a missing proximity rendered as *reassurance*. That is the more dangerous direction than P6-31's `buffettIndicator \|\| 180`, which at least fired a false warning rather than suppressing a real one. In both (b) and (c) the accompanying TEXT was already honest and only the GRAPHIC lied — worth naming, because a reviewer reading the copy would have signed both off. **Latent: 24 further `?? 0` sites on non-nullable fields.** Removed rather than left: a default on a field that cannot be null does nothing today and silently converts a future null into a confident zero — **which is precisely how P6-68 became live**, since `?? 50` was harmless when written and turned into a defect the moment the route learned to return null. Stripping them makes the next such change a type error. **`?? "—"` and `?? "N/A"` were left alone in all 11 places they appear: that is what a missing value SHOULD render as**, and `social-sentiment`'s `?? 0` is correctly gated behind `isLive`. **Rule 12** now fails any component formatting a defaulted number as a measurement, verified by reintroducing one. | Sweep script kept in the scratchpad; the rule is the durable half. 95 components checked. |
| P6-72 | **P1** | **P6-34's decision was enforced in one module and bypassed in another — on a scored input, twice, in one function.** Sweeping `lib/` for the numeric-default idiom (rule 12 covers components and `app/`, `lib/` had never been looked at) turned up `lib/grok-market-data.ts`, whose four helpers each ended `return value || <constant>` — **30, 1.2, 55, 32**. That is precisely the invented baseline P6-34 removed when it made `fetchWithAIFallback` return `{ value: null }` instead of a constant. **P6-34 only edited `lib/unified-ai-fallback.ts`.** The identical pattern had been sitting in a parallel module the whole time. Pulling the thread found something live and worse. **`scrapePutCallRatio` returned `status: "live"` for two things that are not a measured put/call ratio:** (a) a Grok answer — and its own comment said *"Trying Grok AI first for reliability"*, so an LLM's recollection was consulted **before any real source**; (b) `const estimatedPutCall = 0.6 + vix / 50`, a ratio computed from VIX, with a log line reading "estimated from VIX" while the status claimed live. `/api/ccpi` mapped `status === "live"` straight to the `live` tier, and **`live` scores** — so `putCallRatio`, worth **29 of Risk Appetite's 100 points**, could be scored as measured from a guess or from VIX. **P6-34's entire point is that AI estimates do not score, and a self-reported tier walked around it.** The VIX branch was independently the P6-61 defect *inside* the CCPI, since `vix` is already its own scored indicator — two "independent" inputs, one instrument. **FIXED (staging):** the status union gains `"ai-estimate"`, the Grok path returns it, the VIX-derived branch is **deleted** rather than re-tiered (there is no honest tier for a number that is not the thing it is named after), and the CCPI maps the three tiers explicitly. The five dead invented-constant helpers are gone — including `scrapeShortInterest`, which was exported, never imported, and carried a **latent laundering bug**: `fetchShortInterestWithGrok` could never return falsy, so its caller's honest `status: "baseline"` path was unreachable and the constant 1.2 would have gone out as `"live"` the moment anyone wired it up. Same shape as P6-34's dormant Fear & Greed baseline of 50. **Rules 12(lib)/13 added: no AI helper may return a hardcoded constant, and no AI answer may carry a `live` status** — both verified by reintroducing the defect. | **The general lesson, and it is the biggest of the day: a decision enforced in one module is not enforced.** P6-34 was recorded as closed, the checks passed, and the same pattern survived one import away. |
| P6-73 | P2 | **The sign-off ledger cannot show which lenses a tick was granted under, so every ☑ reads as current.** SITE_MAP §6's marks were earned against the sweeps that existed at the time. On 2026-08-11 two lenses were applied for the first time — **provenance** (does a label match the code behind it) and **composite independence** (can input A ever disagree with input B) — and **fourteen tabs that already carried ticks failed one or both**: `insiders`, `market-sentiment`, `panic-euphoria`, `trend-analysis`, `social-sentiment`, `jobs`, `fomc-predictions`, `earnings-calendar`, `calendar-spread-scanner`, `risk-rewards`, `greeks`, `earnings-iv-crusher`, `wheel-scanner`, `exit-rules`. Several were signed off on `data` — the column that means "live/labeled" — while carrying exactly the label defects the provenance lens exists to catch. **This is P6-23 and P6-41 a third time:** a record that cannot distinguish two states presents the weaker one as the stronger. Erased looked like initial; static looked like unaudited; and now **untested-by-a-lens-that-did-not-exist looks like verified**. **FIXED:** `scripts/site-inventory.ts` generates a standing note above the table saying a tick records the lenses that existed when it was granted, naming the fourteen, and stating the rule that outlives them — **adding a lens means re-reading the ticks, not trusting them.** Deliberately NOT done: mass un-ticking. Every one of the fourteen defects is fixed and pinned by rules 1-13, so clearing the marks would destroy real information to make a point already made in prose. | The note is generated, so `pnpm inventory` cannot erase it — the failure mode P6-23 records. |
| P6-74 | **P1** | **A second AI-value-as-`live` bypass, in the same file, on a second scored input — and re-verifying the closed P1s is what found it.** `scrapeAAIISentiment` returned `status: "live"` for an LLM's recollection of the AAII survey, which `/api/ccpi` maps to the scoring tier: **`aaiiBullish` is worth 26 of Risk Appetite's 100 points.** Same bypass as P6-72's `scrapePutCallRatio`, ten lines away in the same module, missed on the first pass. **It is also P6-61:** only `bullish` came from the model — `bearish` was `65 − bullish` clamped to 15-50 and `neutral` was the remainder, so the entire three-way split, and the `spread` computed from it, was manufactured from one guess. A survey's three figures are three measurements; these could not disagree with each other. **FIXED (staging):** the status union gains `"ai-estimate"`, the Grok path returns it, and the CCPI maps all three tiers explicitly. **Also re-verified and found CLEAN, recorded so nobody repeats it:** P6-21 (the yield-curve convention is owned by `lib/yield-curve.ts` and `fomc-predictions` delegates to it rather than recomputing), P6-17 (`^FVX` survives only in comments), P6-32 (one canary generator, correctly imported), P6-18 (no fear-greed 50 defaults remain). | The generalised P6-72 question — *is this decision enforced everywhere, or only where it was found?* — has now caught two live P1s. It should be asked of every closed finding, not just the ones that look fragile. |
| P6-75 | **P1** | **A check silently stopped guarding a file because I reworded a log line, and reported PASS throughout.** Rule 13's scope was `PROVIDER_MARKER.test(code(f))` — a keyword scan for provider names. The only token putting `lib/scraping-bee.tsx` in scope was the string **"xAI" inside a `console.log`**. While fixing P6-74 three lines away, that log was reworded, "xAI" disappeared, and the file dropped out of the rule entirely. **The rule went on passing.** Its single visible symptom was a detail string changing from "12 AI module(s) checked" to "11" — which nothing reads and no assertion covers. It was found only because a deliberate break failed to produce the FAIL it should have. **This is the file's own defect turned on itself:** a label ("AI module") stopped matching what the code did, and nothing noticed — which is the sentence `check-provenance.ts` was written to prevent. It also belongs to the P6-34 family, where a check that stops RUNNING is indistinguishable from one that passes; here a check that stops *covering* is indistinguishable from one that covers. **FIXED:** scope is now structural — a module qualifies if it calls a provider SDK **or imports a known AI helper module** — both of which require changing the module's actual behaviour, not its prose. **Rule earned, and it applies to every check on this project: a check whose scope is inferred from incidental content can be switched off by editing a comment.** Verified by re-breaking P6-74 and confirming the rule now fires. | The PASS-count discipline in CLAUDE.md catches a check that stops running. It does **not** catch a check that keeps running over a shrunken set — the count stays identical. That gap is now on the pre-Phase-7 list. |
| P6-76 | P2 | **P6-35's ceiling figures recomputed — and the obvious guess was wrong, which is the point.** I expected the P6-72/P6-74 fixes to have invalidated 81 / 62 / 59. `scripts/ccpi-certainty-ceiling.ts` drives the real weight tables and reproduces **81 and 62 exactly**. They were correct all along. What was wrong was something worse and harder to see. **62 was a correct SPECIFICATION of a state the code never produced.** Until 2026-08-11, `scrapePutCallRatio` and `scrapeAAIISentiment` self-reported `status: "live"` for LLM answers, so 55 of Risk Appetite's 100 points counted as measured whenever ScrapingBee was down — and the reported certainty was **79**, not 62, with the pillar comfortably above `MIN_SCORED_MAX` instead of dropping out. **The defect did not make the ceiling wrong; it made the live reading exceed it.** An index publishing "79% measured" when 62 was the honest maximum, its largest pillar kept alive by two guesses. **59 is genuinely obsolete** — it described "Alpha Vantage also down", and the VIX-derived put/call branch that distinction rested on is deleted (P6-72); the equivalent scenario now is "ScrapingBee and CNN off", which computes to **55**. The script keeps the pre-fix scenario as a labelled historical row so the gap between 79 and 62 stays visible. **Correcting my own claim: I told the owner these numbers were "now wrong" when proposing this work. They were not.** | **The rule holds in both directions: a number in a document is a claim until something recomputes it — including when recomputing vindicates it.** Had I "corrected" 62 from memory I would have introduced an error while believing I was removing one. |
| P6-77 | P2 | **Audited the other twelve check scripts for P6-75's scope defect — all clean — then applied the lesson to the file that had it.** `check-contract-coverage.ts` derives its scope from **file layout** (`walk(app/api)` filtered on `route.ts`), which is structural and cannot be switched off by editing prose. Its two content-parses — `KNOWN_ROUTES` and the contract `path:` list — both fail **loudly** if the format changes: an empty set makes all 61 routes report as uncovered, so a parse failure cannot masquerade as success. The remaining eleven import their modules directly and have no file-set scope at all. **The gap was only ever in `check-provenance.ts`, and it is now closed there:** three scope floors assert that the component set, the app set and the AI-module set have not collapsed. **The AI-module count that P6-75 silently changed from 12 to 11 is now asserted rather than printed** — verified by breaking the scope rule and watching it fail at 0. The floors are deliberately loose so a genuine refactor does not trip them, with a note that a floor left far below reality is only half a guard. | **The general form, worth more than the fix: the PASS count catches a check that stops RUNNING; nothing catches one that keeps running over a shrunken set, because the count is identical. Any check that derives a file set should assert that set's size.** |
| P6-78 | **P1** | **`pnpm inventory` silently dropped the flagship tab, and I caused it three commits earlier without noticing.** Sweeping the docs for stale figures turned up SITE_MAP's totals line reading **41 public tabs** where it had read 42 all session. The missing tab was **`ccpi`** — gone from §1 and, worse, gone from the §6 sign-off ledger, **taking its four ticks with it**. Cause: `scripts/site-inventory.ts` parsed tab entries with `id:\s*"..."\s*label:\s*"..."([\s\S]{0,400}?)(?=\{\s*id:|$)` — a **400-character window** between one entry's label and the next entry's start. The explanatory comment I added to the `ccpi` entry in `app/page.tsx` while fixing P6-51 pushed that entry past 400 characters, the lookahead could not be satisfied, and the regex **skipped the entry entirely**. No error, no warning; the generator reported success and wrote a smaller file. **This is P6-23 exactly — "a hand-maintained section inside a generated file is a bug unless the generator reads it back, and the failure is invisible because erased looks like initial" — except the generator did read the marks back and still lost them, because the ROW they belonged to had vanished from its input.** Reading marks back protects against a regenerated table; it does not protect against a shrunken one. **FIXED:** the cap is gone (the lookahead alone bounds an entry), the marks are recovered from `5e129f5`, and the parser now **cross-checks its match count against the raw `id:` occurrences in the same source and throws** — "Tab parse lost entries: matched 41 but app/page.tsx declares 42". Verified by reintroducing the cap and watching it throw. | **Found only because a doc sweep compared two numbers.** Nothing in the check suite covers the generator, and `pnpm inventory` is run for its side effect, not its output. A magic-number window in a parser is a silent-truncation bug of the P6-37 family — and this one truncated the audit's own record. |
| P6-79 | P2 | **AUDIT_PLAN.md's inventory totals were ~40% wrong, and nothing had recomputed them since they were written.** The planning document people scope phases against stated *"42 API routes · 53 components · 4 nav categories · 33 public tabs"*. Reality on 2026-08-11: **61 · 87 · 4 · 42** — off by 19 routes, 34 components and 9 tabs. Two per-section counts were stale too ("SCAN + COPY, 15 tabs" against a real 16; "all 33 tabs" in the Phase 6 instruction against 42). **FIXED by deleting the copies rather than correcting them:** the totals line now points at `SITE_MAP.md`, which `pnpm inventory` generates and which therefore cannot drift; the per-section counts are removed from headings that do not need them; the Phase 6 instruction says "every tab" and names §6 as the count to trust. **Same structural move as `lib/allocation.ts` storing only cash and computing stocks: one source, everything else derived.** Correcting the numbers in place would have bought a few weeks before the next drift. **Also swept and verified CORRECT, recorded so nobody re-checks them:** FORMULAS.md's "22 assertions in `check-black-scholes.ts`" (counted: 22) and its "fetch window raised to 320 days" (the route fetches 320). FORMULAS.md's pillar-bound rows — "maxima sum to 90/100", "13 indicators" — are historical descriptions of defects since fixed, and read correctly as such in context. | The two P6-70-family lessons now have a third instance each: a figure nobody recomputes drifts, and a figure that IS recomputed sometimes vindicates the record. Check before correcting, and delete the copy rather than fixing it. |
| P6-80 | P2 | **The generator is now covered — and being precise about what that does and does not buy is the point.** `pnpm inventory` was run for its side effect, its output committed, and neither ever inspected; P6-78 rode that gap for three commits. `site-inventory.ts` gains a **`--check` mode** that renders into memory, writes nothing, and asserts two things, now in `check:formulas` (460 → 462). **(1) SITE_MAP.md matches a fresh render** — catches a STALE file, i.e. routes or components changed and nobody re-ran the generator. That is the rule `CLAUDE.md` has stated since Phase 0 and nothing enforced. The date stamp is normalised out so it does not fire spuriously tomorrow. **(2) §1's tab list and §6's ledger agree** — every tab has a sign-off row, every row has a tab. **What it deliberately does NOT catch, recorded so the coverage is not overstated: a silent drop.** Once the generator loses a tab it loses it from both sections at once, so a regenerate-and-diff would call the smaller file correct — the missing row and the missing tab agree with each other perfectly. **That failure is caught upstream instead, by `parseTabs` asserting its own match count against the raw `id:` occurrences in `app/page.tsx` (P6-78).** Two different mechanisms for two different failures; neither substitutes for the other. **Also verified: a hand-edited MARK does not trip the staleness check**, and should not — marks are hand-maintained and `render()` reads them back, which is the P6-23 fix working as designed. All four behaviours proved by breaking them: a changed generated value fires, an orphaned ledger row fires both assertions, a flipped mark correctly fires nothing. | **"We have a check for that" is the false assurance this audit exists to remove, so a check's blind spot belongs in the record beside the check.** See also the ninth limit: a check that keeps running over a shrunken set reports PASS. |
| P6-59 **CLOSED** (was noted-not-fixed) | P3 | **`calculateMarketVolatility` took a parameter it never used, and the comment described a calculation the body does not perform.** The last thing left logged-but-unfixed from 2026-08-11. It accepted `vix50DayMA`, computed `percentAboveMA` from it, discarded the result, and carried the comment *"Mapping: VIX +50% above MA = 0 … VIX -50% below MA = 100"* — while the body maps the raw VIX **level** (`100 − ((vix − 10) / 30) × 100`). Three statements of one problem: a dead parameter, a dead variable, and a comment documenting intent rather than code. **Two call sites were already passing a literal `0` for that argument** — silent proof somebody knew it was inert, since a real divisor of 0 would have produced Infinity, and exactly the kind of evidence nobody can act on because it looks deliberate. **The comment was describing CNN's real method**, which compares VIX to its 50-day average; this maps the level, so a persistently high-VIX regime reads as fear here and drifts to neutral for CNN as the average catches up. **The level map is KEPT** — changing a live score needs evidence the alternative is better, not just a stale comment preferring it — and the divergence joins the CNN-methodology caveats P6-59 already added to the UI. Deleting the parameter is what stops the next reader believing the average is involved. | Reading the file back to fix the call sites is what surfaced P6-81. |
| P6-81 | **P1** | **A dead second Fear & Greed implementation, holding the worst version of the defect its live sibling was fixed for this morning.** `calculateScoreFromData()` sat in `app/api/market-sentiment/route.ts`, was never called by anything, and computed its own seven-component index. Of those seven "equal-weighted" components: `const putCallScore = vixScore` — **literally the same variable**; `const junkBondScore = vixScore * 0.9` — a scalar multiple of it; `const safeHavenScore = momentumScore` — the same variable again. **vixScore counted three times, momentumScore twice: two instruments wearing seven names**, under the comment *"Equal weighting as per CNN methodology"*. Its signature defaulted `nyseLows = 100, nyseHighs = 50`, scoring **33 — a Fear reading — from no data at all**, the mirror of the 65 Greed default P6-58 found in the live path. **DELETED**, following P6-34's precedent with the dead AI getters: a dormant function is where a defect waits for someone to wire it up, and this one was a copy-paste away from being live. **This is P6-72's lesson a second time inside a single file** — `calculateFallbackIndex` was repaired this morning while its sibling sat ten lines up, untouched, worse. | Found only by reading the file back to update call sites after a P3 cosmetic fix. **Neither the grep sweeps nor any of the thirteen check rules would have surfaced it: it uses no `\|\| <const>`, makes no provenance claim, and dead code makes no claims at all.** |
| P6-82 | P2 | **Dead-code sweep: four genuinely unreferenced exports deleted, and the one that looked deadest turned out to be live and completely untested.** P6-72 and P6-81 were both defects dormant in functions nobody called, so the whole codebase was swept for exports with no reference outside their defining file. **The sweep's own first result was a lesson: it over-reported badly.** "Not imported elsewhere" is not "unused" — `SURVIVORSHIP_WARNING` and `monthsBack` are both consumed in their own files, and `useWheelScanner`/`ThemeProvider` are plainly imported. Filtering to symbols with a single mention in the entire repo — the definition itself — gave four real ones: **`MEGA_CAP_STOCKS` and `MEGA_CAP_STOCKS_ALPHABETIZED`** (two hardcoded ticker universes; **AUDIT_PLAN §2 item 5 suspected exactly this on 2026-08-07 — "now unused?" — and nothing had confirmed it in four days**, so this closes it), **`getContract`**, and **`SEVERITY_CONFIGS`**. All deleted: benign individually, but leaving them makes the next sweep noisier, and a stale ticker list is a fallback waiting for someone to reach for it. **The interesting one was `calculateVega`, which is NOT dead — it drives the Newton step inside `estimateImpliedVolatility`.** It surfaced only because nothing imports it across files. **It had zero test coverage**, in the suite `FORMULAS.md` calls "the verified in-repo reference", while implied volatility is the scanner's premium-richness KPI: a wrong vega makes IV converge slowly, wrongly, or not at all. Six assertions added — the Hull ATM value (0.3752 per percentage point), √T decay, the deep-ITM collapse toward zero, dividend-yield sensitivity, and two null guards. Formulas 462 → 468. | **A dead-code hunt found no dead code where it mattered; it found a live function nobody had tested.** The sweep's value was not the four deletions. |
| P6-83 | P3 | **The generator check earned itself on its first live use, four commits after being written.** Deleting the four dead exports changed the component and lib-module counts, so `SITE_MAP.md` went stale — and `site-inventory.ts --check` (P6-80) failed the suite with *"run `pnpm inventory` and commit the result"* before the commit was made. **Prior to 2026-08-11 that staleness would have shipped silently**, exactly as P6-78's dropped tab did for three commits and P6-79's inventory totals did for four days. Worth recording because a check that has only ever been verified by deliberately breaking it is not yet known to catch anything real. This one now has. | The rule it enforces has been in `CLAUDE.md` since Phase 0 with nothing behind it. |
| P6-84 | P2 | **`normalCDF` — the function every option price, delta and vega runs through — had no direct assertion, and writing one showed it is half an order of magnitude less accurate than its own citation.** The coverage sweep that followed P6-82 flagged it: `lib/black-scholes.ts`'s cumulative normal was covered only **indirectly**, by assertions on the things built from it, which means a compensating error in two places could have passed unnoticed. Seven direct assertions added — the value at 0, ±1, 1.96, the far tail at −3, the symmetry identity `CDF(x) + CDF(−x) = 1`, and monotonicity, which a lookup table or a sign slip would break where a point check might not. **The first attempt FAILED at x = 0**, and the reason is the finding: the implementation is Zelen & Severo 26.2.17, whose published bound is `|ε| < 7.5e-8`, but sweeping x over [−5, 5] against a high-precision `erf` reference gives a measured max error of **1.494e-7**, worst at x = 0 where it returns **0.49999985** instead of 0.5. The cause is benign — the coefficients in the file are 7-digit truncations of the published ones — and the effect is immaterial: 1.5e-7 on a delta of 0.7791, or on a probability rendered to two decimals, is invisible. **The tolerance is now the measured figure, not the cited one.** Writing 7.5e-8 into the test because a paper says so would have been the same cite-instead-of-check this audit keeps finding — and it would have made the suite fail for a reason nobody could act on. Formulas 468 → 475. | **`FORMULAS.md` calls this file "the verified in-repo reference". That should mean somebody checked the numbers, not that somebody cited a source.** The nearest earlier instance is P6-70's breadth trough: recorded from expectation, not from the query. |
| P6-85 | P2 | **An entire branch of `lib/ccpi/` is structurally unreachable from the check suite, which is why its coverage gap exists — identified, deliberately NOT fixed today.** The coverage sweep flagged `getRegimeZone` (in `lib/ccpi/calculations.ts`) as live, computing and untested. Trying to load it revealed the real cause: `calculations.ts` imports `"./constants"` and `constants.ts` re-exports from `"./scoring"`, **both without the `.ts` extension**, which node's type-stripping cannot resolve. So neither module can be imported by a check script at all. **This is the flip side of a rule the project already knows** — `audit-progress` records that "check scripts need import-free libs", and `lib/ccpi/scoring.ts` and `lib/vix-term.ts` are import-free *on purpose* for exactly this reason. What was not recorded is that the constraint silently decides which code can be tested. **The fix is one character per import**: `tsconfig` uses `moduleResolution: "bundler"`, which permits `.ts` specifiers, and `scripts/*.ts` already import `../lib/ccpi/scoring.ts` that way. **Not applied today**, and the reason is the P6-35 precedent: no app-code import in this repo currently carries a `.ts` extension, `pnpm typecheck` would not catch a Next bundler rejection, and this is a staging branch carrying nineteen commits awaiting UAT. A build-time resolution failure discovered during UAT would cost far more than the coverage buys. **What was verified and is worth keeping:** `getRegimeZone`'s boundaries (0/20/40/60/80, selected on the lower edge with `>=`) **agree exactly with `CCPI_ALLOCATION`'s bands and level names** — so the two-independent-classifications defect (P6-47) is not present here. Nothing asserts that agreement, which is the check to add once the modules are loadable. | Next session: add `.ts` to the two relative imports, confirm `next build` resolves, then assert the threshold/allocation agreement. Small, but it needs a build, not a typecheck. |
| P6-86 | **P1** | **A blank env var set the spend hard-stop to $0, because `Number("")` is 0 — found by writing the first assertion these guards have ever had.** Finishing the coverage sweep meant covering the two survivors that guard *operations* rather than display: `checkCronAuth`, the only thing between the internet and the cron endpoints that write to the market store, and the budget-target reader behind the E-5 guard. Neither produces a figure a user reads, which is presumably why neither was covered — **the audit's attention has been on displayed numbers, and a wrong auth check is a different category of problem from a wrong number on a page.** The seventeenth assertion failed. `getMonthlyBudgetTarget` did `Number(process.env.MONTHLY_BUDGET_TARGET)` and accepted any finite value ≥ 0 — and `Number("")` is **0, not NaN**, so a DEFINED-BUT-BLANK variable returned 0 rather than the documented default of 40. **Sweeping for the same trap found it once more, in the more dangerous place:** `readBudget` in `lib/budget-guard.ts` feeds `getDailyHardStop` and `getMonthlyHardStop`, and its comment explicitly says *"A budget of 0 is meaningful (cut off immediately)"* — so a blank `DAILY_HARD_STOP` read as a deliberate instruction to kill every metered API on the first cent of spend, degrading the site with nothing on screen to explain it. **An empty string is the single most likely malformed value for an env var** — Vercel produces one whenever a variable exists with no value, the exact state a half-finished dashboard edit leaves behind, and this session's own YOURS list has been carrying a stray Vercel variable for days. Both now trim, treat blank as unset, and only then let 0 mean zero. **Two siblings swept and CLEARED:** `login-rate-limit`'s `readPositiveInt` and `unified-ai-fallback`'s TTL both require `> 0`, so the empty string falls through correctly. **17 assertions added** — including that the raw secret without `Bearer ` is rejected, that a lowercase scheme is rejected, and that first-char and last-char differences are both caught, which proves the comparison loop visits every position rather than short-circuiting. Formulas 475 → 492. | **Fourth time today that writing a test found the defect rather than confirming its absence** — after `calculateVega` (untested), `normalCDF` (accuracy overstated by its own citation) and now this. The pattern is not subtle: the untested thing was untested because nobody had looked at it, and nobody had looked at it because it was not on a page. |
| P6-87 | P3 | **`lib/budget-guard.ts` received the identical fix and could not be asserted, and the check script says so.** It imports `@/lib/api-costs`, `@/lib/metered-fetch` and `@/lib/api-keys`, so node's type-stripping cannot load it — P6-85's blocker again, now costing coverage on a spend-control path rather than a display one. The behaviour is pinned indirectly, since `getMonthlyBudgetTarget` exercises the same trim-then-parse shape, **but "the sibling is tested" is not "this is tested"**, and the gap is recorded in `scripts/check-ops-guards.ts` beside the assertions rather than left implicit. Extracting `readBudget` into an import-free module would close it; deliberately not done mid-session on a spend-control path. | Third module today found untestable for the same structural reason (P6-85, this, and `lib/fred-store.ts`, which needs Supabase and is genuinely I/O rather than a resolution problem). Worth a single decision next session rather than three separate ones. |
| P6-88 | P2 | **A hardcoded default encryption key sat in `lib/api-keys.ts`, and two earlier hardening passes had routed around it rather than removing it.** The wider env-var sweep that followed P6-86 found `const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY \|\| "default-32-char-encryption-key!"`. **Not a live vulnerability, and worth being precise about why:** nothing in that file ever read it — one occurrence, the declaration itself — and the two modules that handle real secrets both bypass it deliberately. `lib/key-store.ts`, which encrypts admin-pasted credentials, reads `process.env.ENCRYPTION_KEY` directly and returns null below 16 characters; `lib/auth.ts` throws rather than signing sessions with a default. **Both guards were written specifically to avoid this constant — key-store's comment said so in as many words: "No fallback to the hardcoded default in lib/api-keys.ts."** Which is the finding. A previous pass identified the hazard, wrote a defence against it, documented the defence, and **left the hazard sitting in a file named `api-keys.ts` for the next person to reach for.** That is P6-72's lesson applied to a credential: *a decision enforced where the defect was found is not enforced where the defect lives.* Deleted, and key-store's comment updated so it no longer points at something that no longer exists. **Swept and CLEARED, recorded so nobody re-checks:** `\|\| "default"` on STRING env reads is safe — an empty string is falsy, so it falls back correctly, which is the exact opposite of the numeric `Number("") === 0` trap from P6-86. `Boolean(process.env.X)` at the health-check probes is correct for the same reason. `NODE_ENV === "production"` gating the secure-cookie flag is standard. | The numeric and string cases invert: `\|\| default` is the BUG for numbers and the FIX for strings. Anyone sweeping one pattern should not assume the other behaves the same way. |

---

## Session close — 2026-08-10

**PRODUCTION = STAGING = `2ee5a46`.** 15 commits fast-forwarded to `main` and verified
live: the FOMC tab reports `predictionReliability: full` with an empty `unavailable[]`,
the yield curve reads Normal (10Y 4.69 / 2Y 4.25, spread +0.44), and CPI serves
3.46 / 2.57 — the figures that were 2.9 / 3.2 from a hardcoded constant two days ago.

Supabase migrations **0001–0010** applied. Checks: typecheck **10** (baseline was 13),
formulas **159/159**, contracts **59/59**, remediation **31/31** — run individually,
because `pnpm check` chains on typecheck and short-circuits before the other three.

**Dormant until the owner runs `/api/cron/market-snapshot` once:** stored OHLCV bars,
SPY/QQQ capture, and the store-first VIX term structure. All three are deployed and
inert; nothing on the site changes until that job runs.

**Open, in priority order:** P6-29 (delete the eight dead CCPI duplicate components
nothing imports), S-11 and S-14, re-locating the seven stale wheel-scanner references,
and the 16 modules still over the 600-line budget. Ledger stands at 98/336 cells with
`fb` and `size` at 0/42 and `mob` needing a real device.

---

## Session close — 2026-08-10 (evening): the CCPI redesign shipped

**PRODUCTION = STAGING = `8ea467c`.** 62 commits fast-forwarded to `main` after the
owner's UAT — the second production merge of the audit, and the one that replaced the
CCPI's structure rather than its numbers.

Checks, run individually because `pnpm check` short-circuits on typecheck:
typecheck **10** known errors, formulas **422**, contracts **61 routes / 61 contracts**,
remediation **31**. Supabase migrations **0001–0012** applied.

### What shipped

- **Phase 1's result is a clean negative, and that is the finding.** No freely available
  macro series times equity drawdowns at any horizon from 30 to 540 days. 28 window-tests,
  3 in-sample positives, **zero confirmed** out of sample. NFCI scored lift **5.79 in
  sample and 0 out of sample** — the single most valuable number produced, because on
  in-sample evidence alone it would have shipped weighted. The Trigger ships empty.
- **Phase 2** restructured the page: score card on top, an 8-row Trigger section where
  every row carries state, reading, date, meaning and record, then the four pillars in
  numeric order carrying their own role badges. No composite, no gauge, no `NO DATA`
  rendered as `QUIET`.
- **Breadth divergence is live** as Trigger row 8. It will read `NO DATA` for months —
  breadth needs ~280 days of warm-up and the signal needs 61 days of *overlap* with
  stored SPY closes. The row states its own shortfall, so the clock is visible.
- **Five allocation tables became one** (`lib/allocation.ts`), with exact percentages
  drawn to scale, plus `scripts/check-allocation.ts` (36→65 checks) enforcing it.

### Three defects worth carrying forward

1. **Both halves of a complementary pair were stored, five times over.** Columns summing
   to 90, to 110, to 115; two tables inside one component disagreeing, one of them dead
   code nobody rendered. Cash is now the only stored figure; stocks is computed.
2. **A gap in band matching, found by a sweep an hour after shipping.** Bands display the
   way people read them — "0-19" beside "20-39" — and matching `min <= score <= max` left
   19.4 matching nothing, silently rendering no allocation. Bands now select on their
   lower edge, which cannot gap.
3. **Two independent classifications of one score.** `market-sentiment` coloured 3.6% of
   reachable scores as one level while describing them as another, because colour used
   `>= 25/45/56/75` and the text used `<= 24/44/55/74` — identical for whole numbers, and
   the API rounds to one decimal. Predates the allocation work. A third disagreeing chain
   turned up during the refactor, not the audit. No component holds a score threshold now.

**Rule earned: removing duplicated numbers does not remove a duplicated decision.** The
second is harder to see and fails more quietly.

### Triage of P6-38…P6-88, read as a set (2026-08-11)

Fifty-one findings landed in one day. Re-read together rather than one at a time:

**No duplicates, one record defect, three missing cross-references — all fixed.**
`P6-66` had **two rows that disagreed**: the original still read "LOGGED, NOT FIXED"
while a second row two lines below said FIXED, so a reader stopping at the first would
have believed it open. That is the same class of failure as the erased sign-off ledger
(P6-23) — a record contradicting itself is worse than no record. The original now points
forward. `P6-42` was written before its own source was found and did not mention
`P6-52`; `P6-39` logged the insiders mislabel that `P6-42` then actioned. Both now say so.

**They are not thirty-four separate problems. They are five, with variations:**

1. **A label naming a provenance the code does not have** — P6-39, 42, 45, 46, 48, 50,
   51, 59, 62. Three separate tabs borrowed an institution's name (CME FedWatch, CNN,
   Investor Intelligence/AAII) **because the output resembled that institution's
   output. Nobody checked the input in any of the three.**
2. **Invented data served as measured** — P6-42, 43, 52, 53, 58. Two of these were
   fabricated records about **named real people**.
3. **A missing value rendered as a neutral or reassuring reading** — P6-56, 58, 66, 68,
   71. Appeared at every layer: the route, the response, and the component.
4. **A composite counting one input twice** — P6-54, 58, 61, 65, summarised in P6-67.
   **Every one arose from a fallback**, never from a decision to double-count.
5. **A control that accepts input and does nothing** — P6-38, 50, 54.

**Severity note, so it does not read as an oversight:** P6-59 is P2 while P6-45 and
P6-62 are P1 for the same class of false-source claim. The difference is visibility —
P6-59's claim sits on a fallback banner that appears only when CNN is unreachable, while
the other two are always on screen.

**Still open from this set** (authoritative list is the §STATUS LEDGER): P6-65's weight question (the owner's), P6-85 — adding `.ts` to two relative imports so `lib/ccpi/calculations.ts` becomes testable, which needs a `next build` to confirm and was deliberately not attempted on a branch awaiting UAT — and P6-87, the same blocker on `lib/budget-guard.ts`, which this sentence originally omitted.
P6-59's unused-parameter loose end was closed on 2026-08-11 — and reading the file back
to update its call sites is what surfaced P6-81, a dead second Fear & Greed
implementation counting one instrument three times. **The last cosmetic item on the list
led to a P1.**

### What `check-provenance.ts` cannot see — read before Phase 7

Nineteen assertions now guard provenance, and it would be easy to read that as the
problem being solved. It is not. **The check reads source text and answers exactly one
question: does the code behind a claim contain the thing the claim names?** Everything
below is outside that question, and every item is a place a defect of this audit's exact
family could still live.

1. **Whether a number is right.** The check confirms `/api/fomc-predictions` no longer
   claims to read futures. It cannot tell whether `+2 if CPI > 3.5` is a sensible
   threshold, or whether the resulting probability is any good. **Every scoring
   heuristic on this site is unvalidated in this sense** — that is what CCPI Phase 3 is
   blocked on, and no amount of provenance checking substitutes for a backtest.
2. **Whether a model's answer is true.** Rule 2 proves an AI claim can reach a provider.
   It says nothing about what the provider returned. P6-34 is the standing decision on
   that: AI estimates do not score.
3. **Prose that makes no provenance claim.** P6-42 asserted that named people had traded
   stock. It contained no "AI", no "live", no methodology name — nothing rule 2 or 4
   matches. It was found by reading, and **the only reason the rules caught its source
   (P6-52) is that the fabrication happened to be shaped like a ticker beside a price.**
   A fabricated sentence with no numbers in it would still pass every rule here.
   **ATTACKED 2026-08-11, and the result reframes the limit.** Every world-claim in JSX
   was inventoried — assertions with a tensed verb about market actors, temporal deixis,
   or named entities. Twenty candidates across 87 components. **Nineteen were fine**:
   concept explanations ("Year-over-Year CPI shows how much prices have risen") or the
   audit's own "not currently measured" disclosures. The twentieth was
   `market-sentiment`'s fallback banner, and following it into the code found P6-58 and
   P6-59. So the inventory is now clean and can be re-run — but note what it actually
   proved: **the prose was a pointer, not the defect.** The banner was one sentence; the
   fabrication was two synthesized components underneath it. Reading prose finds where to
   look, and the code is where the answer is. That is the same lesson as P6-42 → P6-52,
   arrived at from the other end.
4. **Anything rendered from data rather than written in the file.** The rules scan
   source. Copy that arrives from Supabase, from an LLM, or from an upstream feed is
   invisible to them.
   **Related and newly proven (P6-68): nothing has ever swept the COMPONENT side for
   invented defaults.** Every `|| <const>` sweep this audit ran — P6-18, P6-20, P6-32 —
   stopped at the API boundary. Fixing `/api/trend-analysis` to return a null momentum
   immediately exposed `momentumStrength ?? 50` in the component, which parked the gauge
   on "Neutral", and `priceTarget1Week ?? 0`, which printed **"$0.00"** as a price
   target in the same green as a real one. **`?? <neutral>` in a component is the same
   defect as `|| <const>` in a route.** **DONE 2026-08-11 (P6-71): all 95 components
   swept. Three live defects — two of them misses from the P6-68 fix itself — plus 24
   latent defaults removed, so a future null becomes a type error rather than a silent
   zero. Rule 12 keeps it swept. The `?? "—"` sites were deliberately left: that is what
   a missing value should render as.**
5. **Staleness.** Nothing checked whether a true statement had gone out of date. P6-51
   was exactly that failure — the homepage called the CCPI "AI-powered" and was correct
   when written; P6-34 falsified it by *improving* the index, and no rule noticed
   because nothing compared a claim against a decision. **PARTLY ADDRESSED by rule 10**
   (P6-60): four claims are now pinned to the code facts they depend on, and the pin
   fails in both directions — a broken dependency, or an edited claim leaving a stale
   registry entry. **Still open, and it is the larger half: the registry is
   hand-maintained.** Four claims are pinned out of several hundred sentences. Nothing
   forces a new decision-dependent claim to be registered, so the rule protects only
   what someone remembered to protect. **Narrowed 2026-08-11 (P6-63): eight claims now,
   walked from the recorded owner decisions rather than sampled** — but the gap is
   unchanged in kind. Every future owner decision recorded in this file should ask
   whether any UI copy now depends on it.

**A ninth limit (P6-75): the PASS count catches a check that stops RUNNING, not one
that keeps running over a shrunken set.** Rule 13's scope was a keyword scan, and
rewording a `console.log` removed the only token putting a file in scope. The rule went
on passing; the only symptom was a detail string reading "11 AI module(s) checked"
instead of "12". **Every check on this project should derive its scope from structure —
imports, call sites, file layout — never from incidental prose**, and any check that
reports a coverage count should have that count asserted rather than merely printed.

**An eighth limit, learned today and not in the original list: a composite can be
internally redundant without any individual number being wrong.** P6-58's Fear & Greed
and P6-61's Panic/Euphoria each averaged components that were scalar multiples of each
other — every input sourced, every label honest, and the mean still double-counted one
instrument. No rule here detects that, and no rule easily could: it needs someone to ask
of each pair, **can A ever disagree with B?** **All six composites have now been walked
by hand (P6-67): four were defective, two clean.** Nothing checks any of them again
tomorrow. And the pattern across the four is worth carrying: **every one arose from a
fallback** — a source could not supply a number, someone derived it from a number they
had, gave it the missing thing's name, and the composite then counted the derivation as
evidence. A proxy is a labelling problem right up until it enters an average, at which
point it becomes an arithmetic one.
6. **The retired-phrase list is a memory, not a rule.** Seven exact strings are pinned.
   An eighth defect phrased differently walks straight through.
7. **Mobile, and anything requiring a rendered page.** The `mob` column across all 42
   tabs is unverifiable in this sandbox — the Browser pane does not composite here.

**The honest summary: these checks make it hard to repeat the fourteen defects Phase 6
found, and do almost nothing about the fifteenth.** They are a ratchet against
regression, not a proof of correctness, and the moment they are treated as the latter
they become the same kind of false assurance the audit exists to remove.

### Open, in priority order

Zero-mark tab sign-off is **done** (P6-38…P6-44, 2026-08-11). `federal-money`,
`exit-rules`, the four `learn-*` tabs and `wheel-scanner` are now complete on every
column that applies to them. **Every tab in §6 owes `mob`, and none can get it here** —
the Browser pane does not composite in this sandbox, so mobile is the one column that
needs Joel on a real device.

**A sweep of the other 41 tabs followed** (P6-45…P6-48), looking specifically for
P6-42's shape: hardcoded prose asserting real-world events, named people, dated claims,
or strike-specific trades baked into JSX. **No second instance of fabricated events
exists — P6-42 was the only one** — and no other tab hardcodes a strike. What the sweep
did find is the same defect in its milder form, on 12 more tabs: labels claiming a
provenance the code does not have. The sharpest was P6-45, the FOMC tab wearing CME
FedWatch's name over a heuristic that reads no futures.

**Rule the sweep earned: audit the noun, not the number.** Every one of these tabs
computes something defensible; what was wrong was the word attached to it — "AI",
"implied", "this week", "pre-qualified", "FedWatch". A number can be checked against a
source. A noun asserting where a number came from can only be checked against the code,
and nothing on this project was doing that until now.

**That rule is now a check** — `scripts/check-provenance.ts`, **18 assertions** in
`check:formulas` (422 → 440). It resolves the routes a component fetches and refuses an
AI claim the code cannot reach, refuses a handler-less control, refuses a futures claim
while no futures feed is wired, refuses an API route carrying a ticker with a price,
refuses a UI control bound to a value the route withholds, requires a provenance field to
be read rather than merely declared, and pins seven retired phrases by exact string.

**Every rule found a live defect on the run that introduced it.** The first pass caught a
fifth dead Refresh button and the homepage calling the CCPI "AI-powered" — which P6-34
had made false by *improving* the index (P6-50, P6-51). Nothing in the audit had been
looking in that direction: a claim has to be re-read when the thing it describes gets
better, not only when it breaks. The numeric rules then caught two P1s a prose sweep had
already cleared — **`/api/insider-trading` serving seven invented Form 4 filings about
named real people at HTTP 200, which turned out to be the SOURCE of P6-42** — and
`/api/strategy-scanner` returning invented setups that a component stamped "Last scanned"
(P6-52, P6-53, P6-54).

**The lesson in that sequence is the one worth keeping.** P6-42 was found by reading
prose and fixed by deleting prose. The data it was narrating stayed in the route for
another two commits, and only a mechanical rule found it. **Fixing a false statement is
not the same as removing what made it sayable.**

**Two P1s came out of the tab work itself, both bigger than the tabs they were found
on.** P6-42: the
`insiders` tab published invented trades attributed to Tim Cook, Jensen Huang, Mark
Zuckerberg, Sen. Tuberville and Rep. Gottheimer as "this week", with strike-specific
trades priced off them — deleted. P6-43: the Sell Put Scanner synthesized option
premiums from a fixed 35% IV whenever Polygon's snapshot was quiet and rendered them
identically to live quotes, in a table sorted by the synthesized yield — now labelled.
**Both were found by following a label to the code behind it**, not by any test, and
both had survived every earlier sweep because neither uses the `|| <const>` idiom the
sweeps grepped for.

_Corrected 2026-08-11 (7.1)._ This paragraph read "Remaining: P6-29 dead CCPI
duplicates; S-11 and S-14" — **all three had been fixed the previous day**, each on a
row in this same file. It is the clearest single illustration of why the §STATUS LEDGER
exists. What genuinely remains from this list is the module-size debt (P6-13); the
current open set is in the ledger. **CCPI Phase 3 (scoring) is blocked by design, not effort** — nothing has
earned weight, and it unblocks only on ~2 years of accumulated breadth or a paid credit
source with real history (§8a). Do not "finish" it by inventing weights.

---

## PHASE 6 CLOSED — 2026-08-11

**51 findings (P6-38…P6-88), 24 commits on `audit-preview` at `4caa43f`, production
still `5e129f5`.** Checks at close, run individually because `pnpm check`
short-circuits: typecheck 10 known errors · formulas **492** PASS / 0 FAIL ·
contracts 61 routes / 61 contracts · remediation 31 PASS.

**Read the PHASE 6 SYNTHESIS near the top of this file, not these rows.** The rows
record what was wrong; the synthesis records what kept going wrong, which is what
transfers to Phase 7.

**Two P1s were LIVE ON PRODUCTION when Phase 6 closed. They shipped in the third merge, `21be470`, on 2026-08-11 evening — see the merge record at the end of this file:** P6-42 (the `insiders` tab
publishing invented trades attributed to named real people) and P6-52 (the seed data
that fed it, served at HTTP 200 with a fresh timestamp).

**Open and owned by Joel:** the P6-65 weight decision (should 0.19 of
social-sentiment's composite rest on one Finnhub corpus?), UAT, the `mob` column
across 42 tabs, and clearing any blank `DAILY_HARD_STOP` / `MONTHLY_HARD_STOP` /
`MONTHLY_BUDGET_TARGET` in Vercel (P6-86).

**Phase 7 is planned in [AUDIT_PLAN.md](AUDIT_PLAN.md) as six ordered steps.** It
starts at **7.0 — make the unverifiable verifiable**, which needs a `next build` and
therefore a clean branch; if the merge has not happened, **7.1 (reconcile this file's
inconsistent closure markers) needs no build and can start immediately.**

---

## Phase 7.2 — the admin surfaces, and what following them out found (2026-08-11)

The two lenses Phase 6 built — **provenance** ("does the label match the code behind
it") and **composite independence** ("can input A ever disagree with input B") — had
swept the public tabs, `lib/` and the API routes and had never touched `/admin`, the
health panel or the costs tab. This is that sweep: ~5,350 lines across
`app/admin/page.tsx`, the three `components/admin/*`, `ai-status-admin`,
`ccpi-audit-admin`, `costs-usage-admin`, and the eight `app/api/admin/*` routes.

**The admin came out better than the public tabs, and the negatives are worth recording
so nobody re-runs this.** All ten admin controls have real handlers (shape 5: clean).
No admin component contains a numeric default in any idiom (shape 3: clean). One
provenance-claiming noun exists in admin copy — `ccpi-audit-admin`'s "Implied
Volatility = S&P 500 30-day expected volatility from options pricing" — and it is an
accurate definition of the VIX it labels. The Budget Guard route and panel, the
`api-status` route's coverage note and the health check's own note each state their
scope correctly and are the standard the rest of the site should be measured against.
**The Phase 5b rebuild holds.**

**What the sweep found instead is that the admin is where you can SEE the public tabs'
defects.** Three of the findings below are in public components, and each was reached
by reading an admin file that had already fixed the same thing.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-1 | P2 | ADMIN → Costs | **The Costs tab's budget verdict excludes the only spend that can run away.** "Estimated spend now" sums flat subscription fees; "Budget target" is `MONTHLY_BUDGET_TARGET`; `overBudget` compares the two. Pay-per-use LLM spend — the category E-5a exists because the ledger was blind to it — is in neither number, and nothing said so, so "estimate is $X under budget" read as a verdict on total spend. There are **two budgets on this site governed by three env vars**, and the Costs tab called one of them "the budget". The Budget Guard panel states its own scope correctly ("Cuts off pay-per-use API keys… Flat-rate and free providers are left running"); nothing stated the reverse. **FIXED (staging):** the card says flat plan fees only, names `DAILY_BUDGET_HARD_STOP` / `MONTHLY_BUDGET_HARD_STOP` as the other half, and states that neither figure includes the other. |
| P7-2 | P2 | ANALYZE → CCPI | **`data.totalIndicators \|\| 29` in five places in the flagship dashboard — the exact idiom the admin panel's own comment records as removed.** `ccpi-audit-admin.tsx:145` reads "The old `ccpi.totalIndicators \|\| 29` invented 29 for any falsy value" and takes the real count; `ccpi-dashboard.tsx` never got that fix and prints "3 of 29 warning signals active". The count is derived route-side from the weight tables (`TOTAL_SCORED_INDICATORS`), so the literal is right only by coincidence — change a weight table and five render sites keep printing 29. **The same component answered the same missing field three ways:** `\|\| 29` at five render sites and `?? 0` at two prompt-payload sites. **And the pair was wrong although each half was right:** `/api/ccpi/chat` falls back to `?? TOTAL_SCORED_INDICATORS` and `/api/ccpi/executive-summary` had a fallback of its own — both unreachable, because the client always sent a number, so a missing count would have put **"Active Warning Signals: 3 of 0"** into an LLM prompt. **FIXED (staging):** one `indicatorCount` memo rendering "—", nulls sent to both routes so their derived fallbacks can fire, `CCPIChatModal`'s prop type widened. The executive-summary route's own fallback was the canary-array length — the "3 of 12 against a 29-indicator index" substitution P6-19 named — and is now `TOTAL_SCORED_INDICATORS`. **A decision enforced in one module is not enforced.** |
| P7-3 | P2 | tooling | **Rule 12 could not see an integer default, and its scope was narrower than its name.** `check-provenance.ts` matched a numeric default only when `.toFixed(` followed it — that is, a formatted **decimal**. A count rendered straight into JSX has no decimal places, so `{data.totalIndicators \|\| 29}` walked through, **and P6-71 swept all 95 components under this rule with all five instances present.** A denominator is as much a measurement as a price is. **FIXED:** the rule now also matches `{ … \|\| <int>}` / `{ … ?? <int>}` closing a JSX expression container. Layout arithmetic never appears in that position, so the two patterns stay disjoint and neither needs an exception list. **It found eleven more sites on the run that introduced it** — see P7-6. |
| P7-4 | P2 | ANALYZE → CCPI | **A function named `validate` answered "valid" for a composite it could not compute, and nothing called it.** `lib/ccpi/calculations.ts` held `validateCCPICalculation`, opening `if (calculated === null) return true`. A null composite means no pillar had enough live or AI weight to score — the state most in need of flagging — and it reported clean. A repo-wide symbol search across `app/`, `lib/`, `components/` and `scripts/` returned only its own definition. **Dead code holding a reassuring default, sitting in one of the two modules no check script can load (P6-85), so nothing would have caught it if someone wired it up** — P6-81's shape exactly. Found by asking which of the admin's numbers are recomputed rather than echoed. **FIXED (staging): deleted.** The live implementation of the same decision, `validateCCPI` in `ccpi-audit-admin.tsx`, is correct — an unscoreable composite returns `ok: null`, "NOT VERIFIABLE", not a pass. Two implementations of one decision; the dead one was the wrong one. |
| P7-5 | P2 | tooling | **`check-provenance.ts` printed the wrong line for any file with a block comment above the hit.** `stripComments` replaced a block comment with a single space, collapsing it to one line and shifting every line after it. Four of P7-6's eleven hits pointed at `</CardHeader>` and a chart axis. On a project whose stated highest-yield method is "follow a label to the code behind it", **a check that points at the wrong line is worse than one that prints no line at all: the reader looks, sees nothing wrong, and concludes the finding is stale.** Every `file:line` this script has emitted for such a file was wrong. **FIXED:** a block comment is now replaced by its own newlines, so offsets are exact. Applies to all nineteen rules, not only rule 12. |
| P7-6 | **P1** | six public tabs | **The widened rule 12 found eleven sites, and the sharpest one draws a line on a chart.** `trend-analysis.tsx` rendered `<ReferenceLine y={selectedItem.support ?? 0} label="Support">`, and the same for resistance — an unknown level drew a dashed line labelled **"Support" across y = 0** on a price chart, and because the axis is `domain={["auto","auto"]}` it then stretched to include zero and flattened the whole price series against the bottom. **P6-68 fixed `priceTarget1Week ?? 0` printing "$0.00" in this same component and never reached the chart.** Also fixed: `ccpi-dashboard` rendering "CRASH AMPLIFIERS ACTIVE **+0 BONUS POINTS**" — a contradiction whose reassuring half is the default, the same rule as P6-20(a), where a +0 bonus must not read as "no acute event" when it means "could not check"; `insider-clusters` saying "0 clusters found" while `data` was still null; `insider-trading-dashboard` rendering "(0 trades)" beside "Live SEC Form 4 data via Finnhub"; `politician-spotlight` asserting a 180-day window the response never reported; and `social-sentiment` putting "0/0 sources responded" both on screen and into the AI prompt, at the exact point the prompt is explaining that no reading exists. **Every rule on this project has found a live defect on the run that introduced it. This one found eleven.** |
| P7-7 | P2 | tooling / ops | **`next build` does not run on this machine, which is a second blocker on Phase 7.0 and was not known.** 7.0 was deferred because it "needs a `next build` to confirm the bundler accepts `.ts` import specifiers". `pnpm build` fails at `WasmHash._updateWithBuffer` inside webpack's bundled WASM hasher — `TypeError: Cannot read properties of undefined (reading 'length')` — on Node **v24.16.0** with Next **15.5.9**. **Verified pre-existing:** the working tree was stashed and the identical failure reproduced at a clean `HEAD`, so nothing in this session caused it. `next build --turbopack` bypasses webpack and resolves every module, then fails fetching Geist from `fonts.googleapis.com` — the same blocked outbound HTTPS recorded as P2-6. **So the build gate 7.0 needs is not obtainable locally by either bundler.** **OPEN.** The realistic answers are a Vercel preview deploy — which the staging branch already provides once the merge happens — or a local Node downgrade. Recorded so 7.0 is not attempted a third time on the assumption that only the merge is in the way. |

**The rule 7.2 earned: a fix is not finished until the same question has been asked of
every module that renders the same field.** P7-2 and P7-6 are both one module getting a
fix its sibling did not, and in both cases the fixed module carried a comment
explaining the defect while the unfixed one carried the defect. The synthesis already
named this cause; what is new is that **the comment recording a fix is a reliable place
to look for the instance that was missed.**

---

## Phase 7.4 (first pass) — confirming the four open P1s, which found two live (2026-08-11)

7.1 left four Phase-3 rows marked open with the note that each was "substantially
covered by a later Phase-6 fix — confirm and re-mark before doing any work on them;
three of the four are probably already done." **That prediction was wrong on two of
them, and being wrong in that direction is the whole reason the step exists.** A
bookkeeping pass over a stale ledger would have closed all four.

| ID | Predicted | Measured | Outcome |
|---|---|---|---|
| P3-15 | closed | closed | `ai-estimate` has not scored since P6-34, and the `> 0` acceptance filter is now per-metric plausibility windows. The one surviving `> 0` in `unified-ai-fallback.ts` parses an env-var TTL. **Re-marked `fixed`.** |
| P3-16 | open | open | Panic/Euphoria. Its open remainder is P6-8's open remainder — **the same item carried under two IDs since Phase 3**, which nothing had noticed. Cross-referenced; it closes when P6-8 does, and that needs an owner decision rather than code. |
| P3-17 | closed | **LATENT, still real** | FedWatch (P6-45) and `^FVX`/sign (P6-17, P6-21) were closed. The decay factor was still `1.0 - i * 0.15` **unclamped** — negative from the eighth meeting onward, which sign-flips the expected change so a forecast of cuts starts predicting hikes and the cumulative implied path walks backwards. Not live only because `lib/fomc-schedule.ts` currently holds about five future meetings; **it goes live the first time someone extends the schedule by a year, which is annual maintenance.** Clamped at zero. |
| P3-18 | closed | **LIVE, two fabrications** | (a) `lastMonthChange = finalScore − weekAgoScore × 1.2` and `lastYearChange = … × 2` — the week-ago score times an arbitrary constant, published as the month-ago and year-ago readings. Nothing in the route reads either period. (b) The scrape path set all four historical points to *today's score* under the caption "Extract historical data points for changes", so every delta computed to exactly `0.0` and `trend` reported `"neutral"` on every request. All four are null now, and `trend` is null when there is nothing to compare against. |

**Why P3-18 survived four sweeps, and the lesson worth keeping.** None of the four
change fields is rendered anywhere. They reached the client only through the
cache-validity predicate in `market-sentiment.tsx`, which **required all four to be
numbers** — so the fabrication was load-bearing: making the values honest would have
marked every cached payload invalid and refetched CNN on every mount. That is a new
shape for the ledger:

> **An invented value with no display can still be structurally required.** Every sweep
> this audit has run looked for numbers a user sees. This one was a number only a
> predicate saw, and the predicate had been written around the fabrication's shape. A
> field nobody renders is not therefore harmless — ask what depends on it before
> concluding it is dead.

**Also closed in the same pass** (the two rows 7.1 flagged as wrong in the unsafe
direction): **S-8** — the dead `maxPE` and its "FIX: Declare maxPE state variable"
comment are deleted, and the two hidden Step-4 gates (1% yield, 2M volume) are now
stated on the card, with the false comment calling `minVolumeTechnicals` unused
replaced. Sliders remain unbuilt; naming a gate the user cannot adjust is the honest
half, not the whole fix. **P1-14** — the ~40 commented-out `Math.random()` lines and the
header reading "we generate realistic mock historical data" are gone.

**Not done, and why: S-18.** The step-number drift is now **90 literal "Step N" strings
across nine files**, up from the 40 the row recorded. The fix is one shared constant
plus 90 substitutions, several of which sit inside prose that reads differently
depending on the number. That is a mechanical edit whose only real verification is
looking at the rendered pages, and the browser pane in this sandbox cannot reach a dev
server on the port in use. Scoped, measured, and left for a session that can render it.

---

## Phase 7.3 — which lenses can honestly become rules (2026-08-11)

The step's own instruction: *"Convert a lens into a rule only where the rule can be
honest. Where a lens cannot be mechanised, record that in the limits list rather than
writing a rule that gives the appearance of coverage."* This is the determination, made
lens by lens, with the reasoning kept so it does not have to be re-derived.

**One lens became a rule. Seven are recorded as limits. That ratio is the finding.**

### Became a rule

**Dead code — `scripts/check-dead-exports.ts`, 4 assertions.** The highest-yield lens
the audit had with no check behind it. **Three of the audit's P1s were dormant when
found** — P6-72 (four `|| <const>` helpers bypassing P6-34 in a module nobody re-read),
P6-81 (an uncalled second Fear & Greed counting one instrument three times), P7-4
(`validateCCPICalculation` returning "valid" for a composite it could not compute). Rules
1-19 all ask whether a label matches the code behind it; **an unreferenced function has
no label and no user and passes every one of them.** P6-82 swept for this by hand and
deleted four exports; a hand sweep rots in a release, which is the argument that produced
`check-provenance.ts` in the first place.

**It ships as a ratchet, not a zero, and that is the honest form here.** `lib/` currently
holds **51 exported values referenced only by their own file**, out of 282 across 53
modules. Turning the rule on as `dead.length === 0` would have meant deleting 51 exports
in the commit that introduced it — an unreviewable sweep across 20 modules including the
auth and spend-control paths. The usual alternative, an exception list, is a rule switched
off. So the 51 are named, their count is asserted, **anything not on the list fails**, and
removing one never fails. The debt can only shrink, and the rule states its size rather
than implying `lib/` is clean.

### Found while building it, and it is the P6-75 shape again

**The first run reported `lib/` completely clean, and it was wrong.** The reference scan
walks `scripts/`, and the allowlist names all 51 symbols as string literals — so every
dead export was "referenced" by the list recording that it is unreferenced. The check
found itself.

> **A check whose scope is decided by content can be switched off by writing the right
> content, including its own.** Rule 13 lost a file to a reworded `console.log`; this one
> lost its entire finding set to its own allowlist. The only reason it surfaced on the
> first run instead of passing quietly forever is a defensive NOTE line printing which
> known-dead entries had "become referenced" — it printed all 51 at once, which is not a
> shape real progress has.

The rule now excludes its own file, and this is recorded rather than quietly fixed
because the lesson generalises: **any check that names its own findings must exclude
itself from its own scan.**

### Recorded as limits, with the reason each cannot honestly be a rule

| Lens | Why not a rule |
|---|---|
| Whether a number is right | Needs a reference value or a backtest. This is what CCPI Phase 3 is blocked on; no amount of source scanning substitutes. |
| Whether a model's answer is true | Rule 2 proves a provider is reachable. P6-34 is the standing decision instead: AI estimates do not score. |
| Composite internal redundancy | Needs someone to ask of each pair "can A ever disagree with B". All six composites were walked by hand (P6-67); four were defective. A rule would need to know which inputs are algebraically derivable from which, which is the analysis itself. |
| Unsourced prose | P6-42 asserted that named people had traded stock and contained no matchable token. The JSX world-claim inventory (limit 3) is re-runnable but is a **procedure**, not a rule: its output is twenty candidates a person reads, nineteen of which were fine. |
| Anything rendered from data | The rules scan source. Copy from Supabase, an LLM or a feed is invisible, and making it visible means asserting on live data — which is a health check, not a build check. |
| Staleness beyond the pinned registry | Rule 10 pins eight claims to the decisions they depend on. Nothing forces a NEW decision-dependent claim to be registered, and nothing could without knowing which sentences depend on which decisions. **This remains the largest single gap** and its mitigation is procedural: every owner decision recorded in this file should ask what UI copy now depends on it. |
| A value nobody renders but something structurally requires (**new, P3-18**) | Its four fabricated fields were displayed nowhere and reached the client only through a cache-validity predicate that required them to be numbers. Detecting "a field whose only consumer is a predicate written around its shape" is not a pattern; it is a reading. |
| Mobile | Needs a rendered page on a real device. The Browser pane does not composite in this sandbox. |

### The count, said plainly

**Twenty rules now run** (19 provenance + the new dead-export set), and the honest
summary from the Phase 6 synthesis is unchanged: they are a ratchet against regression,
not a proof of correctness. **P6-81 would still pass all of them** — it was dead code
inside a route file, and the new rule deliberately does not scope route files, because a
route legitimately exports only its handlers and every internal helper would read as
dead. The lens is wider than the rule. That gap is recorded here rather than closed by
widening the rule until it produces noise nobody reads.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-8 | P2 | tooling | **The dead-code lens is now a rule, and it caught itself on the first run.** `scripts/check-dead-exports.ts` (4 assertions, `check:formulas` 507 → 511) walks `lib/` structurally, counts 282 exported values across 53 modules, and fails on any that no other file references. Ships as a ratchet against a named baseline of 51 rather than a zero, for the reason given above. **Its first run reported `lib/` clean because the allowlist names all 51 symbols and the scan walks `scripts/`** — the check referenced its own findings and cleared them. Excluded itself; verified by adding a deliberately dead export and watching it fail, then restoring from a scratchpad copy rather than `git checkout --` (P6-64). |
| P7-9 | P3 | ops / lib | **51 of `lib/`'s 282 exported values are referenced only by their own file, and some are whole modules.** All four exports of `lib/ccpi/logger.ts`, both of `lib/ccpi/progress.ts`, five of six in `lib/ccpi/cache.ts`, three of `lib/serper-finance.ts` and two of `lib/sentiment-sources.ts` — the last being the module S-11 already deleted one dead scraper from. Measured, named and ratcheted by P7-8; **not deleted, deliberately.** Several sit on the auth (`getSession`, `isPasswordHashed`) and spend-control (`getDailyHardStop`, `getMonthlyHardStop`, `isBudgetGuardTrippedSync`) paths, where "nothing references it" and "nothing references it yet" need to be told apart one at a time before anything is removed. **OPEN**, to be burned down module by module as each is next touched. |

---

## Phase 7.4 (second pass) — P0-4 and P1-13, and the row figures were wrong again (2026-08-11)

Two rows open since Phase 0 and Phase 1. Both asked for a measurement nobody had
repeated, and **both row figures turned out to be wrong** — this time in the safe
direction, which is its own kind of expensive: P0-4 has read as a 40-route project for
four phases and was therefore never started.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P0-4 | P2 | site-wide | **"40 of 61 routes have no timeout/abort wiring" was wrong: 35 routes make outbound calls, 26 were already wired, 9 were not.** The row's proposed fix — "a shared `fetchWithTimeout` helper; enforce presence via the contract tests" — had never been built, so every route wanting a deadline hand-rolled an `AbortController` and the rest had none. A hung upstream ties the function up until the platform kills it: the caller waits, the budget is spent, and nothing in the response names the upstream that stalled. **FIXED (staging):** new `lib/fetch-timeout.ts` — deliberately import-free, so it does not inherit the untestability of `lib/budget-guard.ts` (P6-87) — with a 10s default chosen to fail *before* Vercel's own limit so the route can still return a real status. **The dead-export rule written an hour earlier failed on this very module** — `DEFAULT_TIMEOUT_MS` and an `isTimeoutError` helper were exported and imported by nobody. They were removed rather than allowlisted: an unused export is speculative API, which is the thing that rule exists to stop accumulating. (The work `isTimeoutError` was for is real and open: no route yet distinguishes a deadline from a refusal, so a stalled upstream reports 502 where it should report 504.) All 9 routes wired (17 call sites). New `scripts/check-route-timeouts.ts`, 3 assertions in `check:formulas`, deriving its scope from file layout and asserting both counts (P6-75, P6-77) — because "0 routes without timeouts" is also what you get when you find 0 routes. **A number nobody recomputes is a number that drifts**, and that is precisely what cost this row four phases. |
| P1-13 | P3 | ANALYZE → CCPI | **Closed by verification, which is what the row asked for and nobody had done.** It required checking that the dashboard surfaces the baseline flag for four literal constants before it could be marked clean. Two of the four (`ltv`, `spotVol`) were deleted outright by P3-19. The survivors are correctly tiered per-series since P6-6 — `tedSpread: fredData?.tedSpread != null ? "live" : "baseline"` — a `baseline` tier is excluded from scoring and renormalized away (P3-12), and the dashboard renders a per-pillar provenance line off `data.provenance`. The mechanism is real and in place. **FIXED.** |
| P7-10 | P2 | ANALYZE → CCPI | **`nvidiaMomentum: alphaVantageData?.nvidiaMomentum ?? 50` — a neutral-50 default on a 0-100 momentum scale, found while verifying P1-13.** It is scored at `max: 9` in the momentum pillar, and on this scale **50 is a real neutral reading, not an absence** — the exact P6-18 / P6-30 shape. It is not currently a scoring defect: the tier is `alphaVantageLive ? "live" : "baseline"`, so when Alpha Vantage is down the value carries `baseline` and is excluded from the composite. **What is unverified is the display side.** The raw value reaches the dashboard's momentum pillar, and whether it renders "50" beside a baseline label or is withheld was not established. **OPEN**, and deliberately not changed at the end of a long session on scoring-adjacent code: the honest fix is `?? null` with the pillar's null path exercised, and that needs a run against a live CCPI payload. Note the pattern — **P6-4 fixed this exact idiom for AAII in this same route and left the NVDA one**, which is the "a decision enforced in one module is not enforced" cause for the fourth time this phase. |

---

## Phase 7.4 (third pass) — S-10, and the first nine dead exports deleted (2026-08-11)

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| S-10 | P2 | SCAN → Sell Put Scanner (Landmine expected move) | **The fix existed, was tested, and was never wired.** `expectedMove = price × (ATR% / 100) × √(days/7) × 1.5` — a `1.5` fudge with no reference anywhere, rendered as an expected move. `expectedMove()` in `lib/black-scholes.ts` has implemented the standard `S · σ · √T` since Phase 1, **and its own docstring already claimed it "replaces the ad-hoc ATR × 1.5 fudge (AUDIT_BACKLOG S-10)"** while the scanner went on using the fudge. A docstring is a claim about the code, and this one described work nobody had finished. **FIXED (staging):** the fundamental scan cannot compute it — the options chain is not fetched until enrichment, so no IV exists at that point — so it now supplies the earnings date and leaves the move undefined, and `enrichment.ts` fills it from the measured IV it has just read. **Withheld when the IV is synthesized** from the fixed 35% assumption (P6-43): a move derived from an assumed volatility is not an implied move and must not sit in the same column as ones that are. |
| P7-9 | P3 | ops / lib | **First nine of the 51 deleted; 42 remain and the ratchet is lowered to match.** Two whole modules: `lib/serper-finance.ts` (175 lines, three exports, no importer anywhere — `/api/serper-finance` re-implements Serper itself) and `lib/ccpi/progress.ts` (39 lines, referenced only by a barrel that nothing imports). Plus four `console.log` wrappers from `lib/ccpi/logger.ts`, whose only live export is `logError`. `lib/` is now 274 exports across 52 files. **Still open, and one of them is P6-29's shape exactly:** `lib/ccpi/index.ts` is a re-export barrel whose only referrer is a markdown file. |

**A false negative in the new rule, found while using it.** `expectedMove` in
`lib/black-scholes.ts` is imported by nobody, yet it never appeared among the 51 —
because `/api/strategy-scanner` declares a **local** `const expectedMove`, and the rule
counts references by word match. It cannot tell an import from a coincidental
identifier, so a symbol with a common enough name hides in plain sight. Recorded in the
script's limits rather than papered over; closing it properly means parsing imports
instead of text, which is a different tool.

---

## Phase 7.4 (fourth pass) — S-9 verified, the CCPI barrel deleted (2026-08-11)

**S-9 was already fixed and nobody had re-marked it — the third time in two days.**
Its exit condition was "verify the `useEstimatedGreeks` badge actually renders on every
affected cell; if not, add it. Cite the constants' provenance in the tooltip." All of
it holds: `strict-results-table.tsx` and `relaxed-results-table.tsx` mark every affected
cell `est.`, each carries a title reading "No live quote — computed from a fixed 35% IV
assumption", and the header states how many of N rows have no live quote **and warns
that sorting by yield ranks them against real quotes**. P6-43 did this work; the row
kept saying it was open. Confirming rows costs minutes and the ledger has now been
wrong in both directions.

**`lib/ccpi/index.ts` deleted (P7-9).** A barrel re-exporting six modules with zero
runtime importers — its only mentions were in `API_USAGE.md`, documenting an import
style nobody used. **This is the second unused indirection layer this directory has
grown**: P6-29 deleted seven duplicate components and their barrel here for the same
reason. The note added to the README is the point worth keeping:

> **A barrel makes every module in a directory look reachable, which is exactly what
> hides the ones that are not.** `scripts/check-dead-exports.ts` cannot see past one
> either — `export * from "./x"` names no symbols, so it neither creates nor resolves a
> reference.

---

## Phase 7.4 (fifth pass) — P2-2, the cache that cost a round trip to not cache (2026-08-11)

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P2-2 | P2 | ANALYZE → CCPI | **`/api/ccpi/cache` deleted.** It held `let cachedCCPIData` at module scope, so on Vercel the isolate that wrote it is usually not the isolate that reads it. The row said "the cache mostly does not cache"; what re-reading it added is that **the misses were not free.** Three writers and one reader all paid for the illusion: `/api/ccpi` POSTed **its own response back into its own deployment** over HTTP on every request; the dashboard POSTed the same payload again from the browser; `lib/ccpi/api.ts` fired a third write whose `.catch` swallowed every failure — which is precisely why nobody noticed; and `/api/data-source-status` GET it first "because it is cheap", then fell through to `/api/ccpi` anyway. The common path was a wasted round trip followed by the real work. **FIXED (staging):** route, contract, `KNOWN_ROUTES` entry, both server writes, the browser write and the dead `cacheCCPIToServer` all removed. `data-source-status` now reads the live route, which was always the real implementation. **Client-side caching is untouched** — `saveCCPIToCache` uses localStorage and genuinely persists. Routes 61 → 60. |

**Supabase was the row's other option and was not taken.** It would work, but it needs a
migration, and migrations on this project are applied to production on the owner's
explicit instruction (see the 0009/0010 row). Deleting a cache that does not cache needs
no permission and removes three writes and a self-fetch; adding a table that does cache
is a build with an owner in the loop. If per-request CCPI cost becomes the problem, the
store already exists for it — `market_series` and the E-7 pattern — and this is the row
to reopen.

**`check-route-timeouts.ts` failed on the deletion, one commit after being written.**
It asserts the route count, so 61 → 60 broke it exactly as intended. That is the
P6-77 rule earning itself: had it merely *printed* the count, the suite would have gone
green over a route set that had silently changed size.

---

## Phase 7.4 (sixth pass) — P2-4, the first two of sixteen unverified routes (2026-08-11)

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P2-4 | P2 | site-wide | **Sixteen routes are marked `skip` and therefore have no automated verification of any kind; two of them now do.** The contract file has carried the fix since Phase 2 — "give the LLM routes a `?dryRun=1` that exercises the request path without calling a model" — and nobody built it, so the routes most likely to break quietly were the ones nothing watched. **New `lib/dry-run.ts`** (import-free, P6-85) with `isDryRun(request, body)` and `dryRunPayload(route, wouldCall, promptChars)`. **Converted: `/api/ccpi/executive-summary` and `/api/scenario-analysis`** — both now contract-tested at a 5s budget instead of skipped at 30s. **The placement matters and is deliberate:** the executive-summary dry run returns *after* `ensureBudgetGuardFresh()`, because a guard that fails to refresh is exactly the silent spend-control break this route had no test for. **STILL OPEN:** three LLM routes remain (`/api/ccpi/chat`, which streams and needs a different response shape; `/api/insider-trading/ai-insights`; `/api/earnings-calendar/insights`), plus the eleven skipped for reasons a dry run does not address — cron pipelines that write to stores, auth routes with rate-limit side effects, and fan-out audit endpoints that would double every provider's call volume. |

**The rule the helper is written around, because this project has shipped the mistake
twice.** A dry run **must not return content shaped like an answer**. P6-53 was a route
returning three invented trade setups under a comment admitting they were defaults;
P6-52 was seven invented Form 4 filings at HTTP 200. A route that replies with plausible
prose when asked not to think is a synthetic-data generator with a flag on it. The
payload carries `dryRun: true` and facts about the request — the route name, the
provider chain it *would* have used, the prompt length — and never a summary, an
analysis or a number that could be read as a reading.

**And what it does not verify, recorded so the coverage claim cannot grow past it:**
routing, auth, body parsing, input validation, the budget guard, key resolution and the
response envelope are covered. **Whether a provider answers is not.** `/api/ai-status`
covers reachability; P6-34 is the standing decision on what a model's answer is worth.

---

## Phase 7.4 (seventh pass) — the dead-export list, 41 → 17 (2026-08-11)

**The 41 split cleanly in two, and the split is what made the work safe.** For each
symbol, count its occurrences inside its own file: more than one means it is used
internally and the `export` keyword is the only thing that is wrong; exactly one means
the declaration is the sole occurrence and the code itself is dead.

- **24 used internally — `export` removed, code kept.** The change is one keyword per
  symbol and **`pnpm typecheck` is the proof**: if anything had imported them the build
  would fail immediately, and it did not. This is the right move on the paths that
  needed care — `getSession`, `isKeyConfigured`, `getDailyHardStop`,
  `getMonthlyHardStop`, `isBudgetKilled` are all live logic that was merely wearing a
  public surface it did not have callers for.
- **17 with no use at all — left for a deliberate pass.** Deleting these removes
  behaviour, not a keyword, and three sit on security or spend-control code
  (`isPasswordHashed`, `isBudgetGuardTrippedSync`, `providerToKey`). They are named in
  the ledger row below so the judgement is a list to work through rather than a sweep.

`lib/` is now **251 exported values across 52 files**, down from 282 across 53. The
ratchet baseline moves 41 → 17 with it.

**The distinction is worth keeping as a rule.** "Unused export" is two different
findings wearing one name: **a false public surface**, which is a keyword and a
typecheck away from fixed, and **dead code**, which needs someone to decide whether the
behaviour should exist. Treating them as one list is why P6-82's hand sweep deleted only
four and stopped — the easy 24 were sitting behind the hard 17.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-9 | P3 | ops / lib | **41 → 17.** Twenty-four exports un-exported (used internally; typecheck confirms no importer), nine deleted earlier in the phase. **The 17 that remain need a decision each, not a sweep:** `streamWithFallback`, `getProviderStatus`, `recordApiUsage`, `getServiceUsage`, `isPasswordHashed`, `providerToKey`, `isBudgetGuardTrippedSync`, `clearCCPICache`, `loadHistoryFromCache`, `saveSummaryToCache`, `loadSummaryFromCache`, `getBarColor`, `getRegimeColor`, `getIndicatorStatus`, `isQuiverConfigured`, `getTwitterSentiment`, `getFinnhubNewsSentiment`. Note `recordApiUsage` is A-13's finding — the function whose absence of callers made the admin Costs tab read a permanent 0 — and the three `lib/ccpi/calculations.ts` colour helpers sit in a module no check script can load (P6-85). **OPEN.** |

---

## Phase 7.4 (eighth pass) — P2-4 closed: all five LLM routes probeable (2026-08-11)

Skipped contracts **16 → 10**. Every route that was skipped *because a probe costs a
model call* is now contract-tested, at a 5s budget instead of 30–60s:

| Route | What the probe now covers |
|---|---|
| `/api/ccpi/executive-summary` | Body parsing, the null-aware pillar rendering, **and the budget-guard refresh** — the dry run deliberately returns *after* `ensureBudgetGuardFresh()`, because a guard that fails to refresh is the silent spend-control break this route had no test for. |
| `/api/scenario-analysis` | The `question` validation and its 400 path, then the prompt build. |
| `/api/insider-trading/ai-insights` | The trades validation, the 400 path, and the whole per-ticker aggregation — the deterministic half of the route, and the half that can be wrong without anyone noticing. |
| `/api/earnings-calendar/insights` | Body parsing, and it **reports the fan-out it would have caused** (`wouldCallCount` = one call per earnings row, one per economic row, plus a summary). This was the most expensive probe on the site, which is why it was skipped, which meant the costliest route had the least verification. |
| `/api/ccpi/chat` | The system-prompt build — **where P6-19 found pillars rendered to the model as "0/100"** — and the budget-guard refresh. It answers JSON rather than a stream, and that is the honest shape: there is no stream because there is no model. A probe returning an empty UI-message stream would assert that streaming works when nothing streamed. **The streaming transport itself stays unverified**, and the contract says so. |

**The ten that remain are skipped for reasons a dry run does not address**, and none of
them is an LLM cost: five cron pipelines that write to the market stores, two auth
routes with rate-limit and session side effects, two fan-out audit endpoints that would
double every provider's call volume, and the metered ScrapingBee route. Those need
either a test environment or a decision that probing them is acceptable — a different
problem from this one, and not one to hide behind the same word.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P2-4 | P2 | site-wide | **CLOSED for the LLM group.** All five routes skipped for model cost are now contract-tested via `lib/dry-run.ts`; skipped contracts 16 → 10. Every remaining skip is a store write, an auth side effect, a fan-out, or metered scraping quota — recorded above so "16 routes have no verification" is not carried forward as though it were still one problem. |

---

## THIRD PRODUCTION MERGE — 2026-08-11 evening

**`5e129f5` → `21be470`, 36 commits, fast-forward, on the owner's explicit UAT
approval.** `main` and `audit-preview` are identical.

**The two P1s are off production.** P6-42 — the `insiders` tab publishing fabricated
trades attributed to Tim Cook, Jensen Huang, Mark Zuckerberg, Sen. Tuberville and Rep.
Gottheimer as "this week" — and P6-52, the seed data that fed it at HTTP 200 with a
fresh timestamp. They had been live on www.options-calculators.com since the audit found
them on 2026-08-11 morning. **Any statement elsewhere in this file that they are live is
historical; the §STATUS LEDGER is the current record.**

Checks at merge, run individually: typecheck **10 known** · formulas **514** ·
contracts **60 routes / 60 contracts** · remediation **31**.

Ships Phase 7 steps 7.1 (the STATUS LEDGER + its check), 7.2 (the admin sweep, P7-1…P7-7),
7.3 (dead code becomes a rule) and eight 7.4 burn-down passes — P0-4, P1-13, P1-14, P2-2,
P2-4, P3-15, P3-17, P3-18, S-8, S-9 and S-10 closed, dead exports 51 → 17, four new check
scripts. **Routes 61 → 60** (`/api/ccpi/cache` deleted, P2-2).

**Not verified on www yet.** Nothing has been checked against production since it moved.

---

## Phase 7.4 (ninth pass) — P7-9 closed: the last 17 dead exports, one decision each (2026-08-11)

`KNOWN_DEAD` is **empty**. The ratchet that started at 51 is now a zero, so any new
unreferenced export in `lib/` fails the suite rather than joining a list.

Seventeen decisions, not one sweep. Grouped by what the decision turned out to be:

**Deleted because the behaviour was superseded (11).**

| Export | Why it had no caller |
|---|---|
| `lib/api-usage.ts` (whole module: `recordApiUsage`, `getServiceUsage`, `getUsageStats`) | A-13's counter. `recordApiUsage` was called from nowhere, so the reader was structurally incapable of returning anything but 0 — and `/api/admin/usage` still shipped that 0 as `usageCount: … ?? 0`. The component had stopped rendering it; the field stayed on the wire, which moved the trap one layer out instead of removing it. `lib/metered-fetch.ts` measures the calls that actually happen. |
| `getProviderStatus` | A strict subset of `getProviderChain` — same array, same `config.key()`, minus order/model/tier/endpoint. Two functions deriving one answer from one array is exactly the drift `getProviderChain` exists to prevent. |
| `providerToKey` (+ `PROVIDER_TO_KEY`) | Mapped a ledger provider tag to a key for per-provider attribution. The guard is all-or-nothing by design — it caps a total and disables every guarded key — so there is no decision to attribute to. It was also a **third** written-down copy of the provider vocabulary, with nothing tying the three together. |
| `isBudgetGuardTrippedSync` | A second way to ask whether the guard is tripped, carrying its own copy of the fail-open default, on a spend-control path. The one caller that cannot await — `resolveApiKey` — reads the snapshot directly. |
| `isQuiverConfigured` | A boolean wrapper none of the three Quiver call sites can use: each needs the key VALUE to send, and resolves-and-tests in one step. |
| `clearCCPICache`, `saveSummaryToCache`, `loadSummaryFromCache` | No control clears the CCPI cache; the executive summary is fetched per use. A matched save/load pair with no caller on either side. |
| `getBarColor`, `getRegimeColor` | `getRegimeColor` classified a CCPI level into five bands off `CCPI_THRESHOLDS` — the same classification `getRegimeZone` performs, returning a Tailwind class instead of a colour name. One score, two classifiers, one caller. `getBarColor` bucketed at 33/66 for a bar that renders a continuous CSS gradient. |
| `getIndicatorStatus` | Belonged to a replaced design. **The live component declares its own `CCPIIndicatorThresholds` under the same name and an incompatible shape**, so the repo held two, and importing the wrong one type-errors in a way that reads as the caller's mistake. |

**Deleted including a live caller (1).**

`saveHistoryToCache` / `loadHistoryFromCache` were **a write-only cache**. The dashboard
called the writer on every history fetch and nothing ever read the key back. Deleting only
the dead reader would have kept the cost and removed the evidence: localStorage is a
per-origin quota shared with the CCPI snapshot that *is* read, so the largest unread
writer is the one most likely to push the quota over and start failing `saveCCPIToCache`.
`CACHE_KEYS` is down to one entry.

**Deleted after P7-11 exposed them (3).** `getTwitterSentiment`,
`getFinnhubNewsSentiment` and `getPolygonNewsSentiment` in `lib/sentiment-sources.ts`.
All three returned `score: -1` as their "no data" sentinel in a field whose live range is
0-100 — a magic number that survives one arithmetic step and stops being recognisable,
landing inside the valid range as a real bearish reading. `/api/social-sentiment` imports
two functions from this module and reads Finnhub and Polygon through its own local
implementations against **different corpora**.

**Kept and wired to the caller that had reimplemented them (2).**

| Export | What the duplicate was doing |
|---|---|
| `streamWithFallback` | `/api/ccpi/chat` carried its own copy of the provider chain, and the copy had **drifted to six providers against the canonical seven — Perplexity was simply absent**, so a chat turn gave up one fallback earlier than every other AI route. Its ledger `provider` tags had drifted too ("OpenRouter (free)", "Groq", "xAI" against "openrouter", "groq", "xai"), splitting one vendor across two rows in the admin Measured-usage card. **The sharp end: `getProviderChain()` is what the admin panel renders as "the live fallback chain, in the exact order the generate/stream loops try it", and it is derived from the canonical array — so the panel was stating something untrue about this route.** That is a provenance defect, not a tidiness one. `streamWithFallback` was dead for exactly as long as the copy existed. |
| `isPasswordHashed` | Its docstring said "for the admin UI" and the admin UI had reimplemented it: `/api/admin/run-health-checks` computed its own `Boolean(process.env.ADMIN_PASSWORD_HASH)` rather than asking `lib/auth.ts`, the module that decides which credential path actually runs. The reader now asks the verifier. |

**Un-exported (1).** `lib/remediation.ts:routeFile` — used only inside its own module.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-9 | P3 | ops / lib | **17 → 0. CLOSED.** Fourteen deleted, two wired to callers that had reimplemented them, one un-exported. `KNOWN_DEAD` is empty and `KNOWN_DEAD_BASELINE` is 0, so the rule now claims `lib/` is clean rather than claiming it does not get dirtier. `lib/` is 230 exports across 51 files. The two "keep" decisions each removed a live duplicate, and one of them (`/api/ccpi/chat`) was making the admin panel's provider-chain display false. |

### P7-11 — the check counted a diverged twin as a reference

`check-dead-exports.ts` tested whether a symbol's name appears anywhere else in the repo.
A file that **declares its own** function of that name therefore scored the lib export
live — so the one case where a dead export is genuinely dangerous, a second
implementation under the same name reading different data, was the case the rule was
blind to. It is the P6-75 shape once more: the check's answer decided by content rather
than structure.

Found by hand, the only way it could be found: `/api/social-sentiment` declares a local
`async function getPolygonNewsSentiment()` and calls that, while the lib export of the
same name sat unreferenced and unreported.

The fix keys off a declaration form (`function|const|let|class <name>`), not a keyword,
so rewording a comment cannot switch it off. It surfaced one more genuine finding
immediately — `lib/remediation.ts:routeFile`, "referenced" only by an unrelated local
`const routeFile` in `check-provenance.ts` — and it **reports what it suppressed** on a
`NOTE` line, because a rule that silently stops counting something produces the same PASS
line as one that found nothing (P6-77).

Sixteen collisions are currently reported. Most are benign — `const rsi = calcRSI(prices)`
is a result variable, not a re-implementation, and `SOX_REFERENCE_LEVEL`'s two copies are
already asserted equal by `check-ccpi-canaries.ts:207`. **Three are not** (P7-12, P7-13).

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-11 | P2 | tooling | **`check-dead-exports.ts` counted a same-named local declaration as a reference.** The diverged-twin case — the one a dead-export rule most needs to catch — was invisible to it. Fixed structurally; collisions are now reported rather than silently dropped. |

### P7-12 / P7-13 — what the collision NOTE found

**P7-12 is a live defect, not a cleanup.** `components/greeks-calculator.tsx` declares its
own `normalCDF`, `normalPDF` and `calculateGreeks` while `lib/black-scholes.ts` exports
all three behaviours. The `normalCDF` bodies are byte-identical, so the duplication is not
the harm; **the missing guard is.** `lib/black-scholes.ts` runs `isUsable()` and returns
`null` on non-positive time or volatility, so the UI renders "—". The component has no
such check: at T=0 or IV=0 it divides by zero and renders NaN/Infinity Greeks on a public
calculator tab. This violates CLAUDE.md's "option math from `lib/black-scholes.ts` — never
re-implement locally" and its null rule in one place. **Not fixed here** — it changes
numbers on a user-facing tab and belongs in its own change with its own UAT.

P7-13 is the rest of the family: `expectedMove` recomputed inline in
`/api/strategy-scanner` rather than called from `lib/black-scholes.ts`;
`fetchExecutiveSummary` declared locally in `components/ccpi-dashboard.tsx` alongside the
`lib/ccpi/api.ts` export of that name; and `daysBetween` written three times
(`lib/breadth-backtest.ts`, `lib/ccpi/drawdowns.ts` exported, `lib/ccpi/lead-time.ts`
private). None is known to be wrong today; each is a place where two copies must be found
to change one behaviour.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-12 | P2 | LEARN → Greeks | **The Greeks calculator computes Black-Scholes itself and skips the degenerate-input guard.** `lib/black-scholes.ts` returns null for T≤0 or IV≤0 so the UI can render "—"; the local copy divides by zero and renders NaN. **OPEN.** |
| P7-13 | P3 | site-wide | **Three same-name duplicates of live code**, surfaced by P7-11's NOTE: `expectedMove` inline in `/api/strategy-scanner`, `fetchExecutiveSummary` in `components/ccpi-dashboard.tsx`, and `daysBetween` in three modules. **OPEN.** |

---

## Phase 7.4 (tenth pass) — P7-12 and P7-13, and a correction (2026-08-11)

### The correction first

**P7-12 was recorded as "renders NaN on a public calculator tab". That was wrong.**
The `useEffect` in `components/greeks-calculator.tsx` screened its inputs
(`if (stock > 0 && strike > 0 && days > 0 && iv > 0)`) before calling the local math, so
no NaN ever reached the screen. The row is corrected rather than quietly reworded,
because a backlog that overstates a defect is the same failure as one that understates it
— and this file's whole argument is that the record has to be checkable.

**The real defect was in the same four lines, and it was live.** That `if` had no `else`,
so when any input went to zero or was cleared, `setGreeks` was never called and the panel
below went on rendering **the last computed set**. Delete the implied volatility, and the
screen kept showing Greeks for an IV that was no longer entered — stale numbers presented
as current, with nothing marking them stale. Fixed by making the effect unconditional:
`calculateGreeks` now returns `null` on unusable inputs and the panel hides, which is the
same behaviour the rest of the site uses for absent data.

### P7-12 — the library could not supply what the rule demanded

`components/greeks-calculator.tsx` declared its own `normalCDF`, `normalPDF` and
`calculateGreeks` against a house rule that says option math comes from
`lib/black-scholes.ts` and is never re-implemented locally.

**The reason it did is the part worth recording: `lib/black-scholes.ts` had delta and
vega, and no gamma, theta or rho.** Two of the five Greeks that component renders. The
rule was not followable for that file, so whoever wrote it did the only thing available.
A rule with no implementation behind it gets broken by anyone doing the work, and blaming
the call site misses where the fix belongs.

So the fix went into the library first. `calculateGamma`, `calculateTheta` and
`calculateRho` now exist, with the module's existing contract: dividend yield applied, and
`null` — never a number — on non-positive time, price or volatility.

Two substantive differences died with the copy:

- **The local theta dropped the dividend term**, which overstates decay on dividend
  payers. Same direction of error as the delta fix P6 already made in this module.
- **The guard lived in the caller, not the math.** The `useEffect` screened its inputs, so
  that one call site was safe; anything else importing the local helpers would not have
  been. `dTerms()` now refuses degenerate inputs for every caller. Gamma is the one that
  matters most — its denominator carries σ√T, so an unguarded implementation returns
  `Infinity` exactly at expiry, and `Infinity` formats onto a screen rather than failing.

**Nineteen new reference checks, against a published source.** The fixture is Hull ch. 19's
worked example (S=49, K=50, r=5%, σ=20%, T=20 weeks) chosen precisely because its Greeks
are printed in the book: delta 0.522, gamma 0.066, vega 12.1, theta −4.31/year, rho 8.91.
An external reference cannot be re-derived from the implementation the way a
self-generated expectation can. All five match. The unit conversions are asserted
explicitly — Hull quotes vega per unit of vol and theta per year, this module reports vega
per percentage point and theta per calendar day — because a units slip is the most likely
error here and the least visible.

One tolerance is set by **Hull's precision, not ours**: he prints three significant
figures, so "12.1" is any value in [12.05, 12.15], and the computed 12.1055 agrees with
it. A tighter band would have been rejecting the reference's rounding and calling it a
defect. Formulas 514 → 533.

### P7-13 — one of the three was a fix, and the other two were not

`expectedMove` **fixed.** `/api/strategy-scanner` recomputed `price * ivData.atmIV *
Math.sqrt(1/365)` inline instead of calling the library function of that name. Same
formula — but `ivData.atmIV` is upstream data, so a zero is a state the loop can reach,
and the library returns `null` there instead of producing a number from it. The route now
skips the row.

`fetchExecutiveSummary` **is not a duplicate to collapse** — it is P7-14. See below.

`daysBetween` **wontfix, and the reason is in the code already.** `lib/ccpi/lead-time.ts`
declares in its own header that it is deliberately dependency-free: *"node's type
stripping cannot resolve extensionless local imports, so anything a check script must load
stays import-free."* The same constraint that makes `lib/ccpi/calculations.ts` untestable
(P6-85) is what forces this helper to be written where it is used. All three bodies return
`NaN` on malformed input, so they are behaviourally identical; collapsing them would trade
test coverage for tidiness. Recorded as P7-15 so the next reader does not re-open it.

### P7-14 — reference is not reachability

Chasing P7-13's `fetchExecutiveSummary` found something the dead-export rule cannot see.

`hooks/use-ccpi-data.ts` exports `useCCPIData`, and **nothing in the repo imports it.**
The CCPI dashboard carries its own state and its own fetches. The hook is unreachable
code.

It is also the sole referrer for eight `lib/` exports — `fetchCCPI`, `fetchCCPIHistory`,
`fetchExecutiveSummary` and `refreshCCPIData` in `lib/ccpi/api.ts`, the `getCachedData` /
`setCachedData` / `hasFreshCache` trio in `lib/ccpi/cache.ts`, and `logError` in
`lib/ccpi/logger.ts`. Every one of them passes `check-dead-exports.ts`, correctly: they
*are* referenced. They are just referenced by something no page can reach.

**This is the honest limit of the rule as built, stated rather than pretended away.** It
answers "is this symbol referenced", which is one hop. Reachability is the transitive
question, and a module that nothing imports keeps its whole import surface alive
underneath it. P7-9 burned a list down to zero against a rule that a single unreachable
file can hold open.

Left OPEN rather than swept: deleting the hook cascades into eight more one-at-a-time
decisions, which is the P7-9 discipline again and deserves its own pass — not a tail
appended to this one. Note that `saveCCPIToCache` / `loadCCPIFromCache` survive either
way; the dashboard imports those directly.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-12 | P2 | LEARN → Greeks | **FIXED, and the original wording corrected.** The component's own Black-Scholes is deleted; `lib/black-scholes.ts` gained gamma, theta and rho — whose absence was why the copy existed — with 19 checks against Hull ch. 19's published values. The live bug was an `if` with no `else` leaving the previous Greeks on screen after an input was cleared, not the NaN first recorded. |
| P7-13 | P3 | site-wide | **FIXED.** `/api/strategy-scanner` calls `expectedMove` from `lib/black-scholes.ts` and skips the row on null, instead of recomputing the formula inline over upstream data that can be zero. |
| P7-14 | P2 | ANALYZE → CCPI | **`hooks/use-ccpi-data.ts` is unreachable — nothing imports `useCCPIData`** — and it is the only referrer for eight `lib/` exports, which therefore pass the dead-export rule while being unreachable from any page. **The rule tests reference, not reachability**, and one unreachable module holds its whole import surface open. **OPEN**, because deleting it cascades into eight further decisions. |
| P7-15 | P3 | tooling / lib | **`daysBetween` is written three times, deliberately.** `lib/ccpi/lead-time.ts` documents why: a module a check script must load under bare node has to stay import-free, since type stripping cannot resolve extensionless local imports (the P6-85 constraint). All three bodies are behaviourally identical. **WONTFIX** — collapsing it trades test coverage for tidiness. |

---

## Phase 7.4 (eleventh pass) — P7-14: one unreachable file held eight exports open (2026-08-11)

`hooks/use-ccpi-data.ts` exported `useCCPIData` and **nothing in the repo imported it.**
Deleting it dropped eight `lib/` exports onto the dead list in one step, then two more
behind those — every one of which had been passing `check-dead-exports.ts` honestly,
because they *were* referenced. Just referenced by something no page could reach.

**What went, and why each was its own decision:**

| Deleted | Decision |
|---|---|
| `hooks/use-ccpi-data.ts` | Unreachable. It is also a full second CCPI data layer, and **it auto-fetches on mount** — `useEffect(() => loadInitialData(), [])` — which is precisely what the dashboard's `DataLoadGate` ("Nothing loads until you choose to") exists to prevent. Wiring it up would have silently restored the cost-and-consent behaviour that gate was built to remove. |
| `lib/ccpi/api.ts` (whole module: `fetchCCPI`, `fetchCCPIHistory`, `fetchExecutiveSummary`, `refreshCCPIData`) | The hook was its only importer. Its `fetchExecutiveSummary` also POSTs raw `CCPIData` where the dashboard's live path builds a deliberate payload carrying the P6-19 fix (pillars rendered null-aware rather than as "0/100") and the P7-2 fix (`totalIndicators` from the payload, not the canary-array length). **The fix had been applied to one of the two paths.** |
| `lib/ccpi/logger.ts` (whole module: `logError`) | A one-line `console.error` wrapper. Its four siblings were deleted in P7-9 for the same reason; this was the last one, kept alive only by the hook. |
| `getCachedData` / `setCachedData` | Pure aliases of `loadCCPIFromCache` / `saveCCPIToCache`. Two names for one function is how half the call sites end up on each. |
| `calculateCCPI` | **A second implementation of the composite**, and its own docstring said so — "mirroring lib/ccpi/scoring.ts's composite semantics". Mirroring is the defect. It existed so the logger could print a number beside the real one, it lived in the module no check script can load (P6-85), and a composite that can disagree with itself is the worst defect this index can carry. |
| `formatPillarContribution` | Built the logger's console string. Nothing rendered it to a user. |

`lib/` is 224 exports across 49 files, down from 230/51.

### The limit this exposed, stated plainly

`check-dead-exports.ts` answers **"is this symbol referenced"** — one hop. It cannot
answer **"is this symbol reachable"**, which is the transitive question, and a module
nothing imports keeps its entire import surface alive underneath it. P7-9 burned a list
of 51 down to zero against a rule that a single unreachable file was holding open in
eight places.

This is recorded as a limit rather than fixed. Walking the import graph from `app/`
entry points is a materially different check — it has to resolve the `@/` alias, handle
dynamic imports and Next's file-based routing, and decide what counts as an entry point
— and a half-built reachability check that silently misses an entry point would report a
clean repo for the wrong reason. That is the failure mode this phase keeps finding, and
building it badly is worse than naming it.

### P7-16 — the CCPI tab can show an old snapshot without saying so

Found while deciding whether `hasFreshCache` should go with the rest.

`components/ccpi-dashboard.tsx` loads `loadCCPIFromCache()` **unconditionally, at any
age**. It sets `fromCache` and `cacheTimestamp` into component state at four sites —
lines 116, 150, 196, 197 — and **reads neither anywhere**. There is no render site for
either value.

So the tab can display a CCPI snapshot from any point in the past with nothing on screen
marking it as cached or dating it. The freshness machinery to prevent that exists in
`lib/ccpi/cache.ts` and was wired only into the unreachable hook.

It is the same family as P7-12's stale Greeks, one level up: state that stops being
current while the display keeps asserting it. It is worse here in one respect — the
Greeks panel recomputed from inputs still on screen, whereas this snapshot has no visible
input at all to contradict it.

**`hasFreshCache` is therefore kept with no caller and allowlisted**, with the reason in
both the export's docstring and the allowlist entry. It is the exception the `KNOWN_DEAD`
comment describes — an export with no caller *yet* — and it is the first entry added
under that rule rather than inherited from the original 51. `KNOWN_DEAD_BASELINE` is 1.

Not fixed here: rendering a cache-age line is user-visible copy on a public tab, it needs
`check-provenance` review (a label is a claim), and it wants UAT. It is a change, not a
cleanup.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-14 | P2 | ANALYZE → CCPI | **FIXED.** `hooks/use-ccpi-data.ts` was unreachable and held eight `lib/` exports open; deleting it and following the cascade removed two whole modules (`lib/ccpi/api.ts`, `lib/ccpi/logger.ts`), two aliases and a **second composite implementation** (`calculateCCPI`). The hook also auto-fetched on mount, which would have defeated the dashboard's load gate. `lib/` 230 → 224 exports. **The rule's one-hop limit is recorded above rather than half-fixed.** |
| P7-16 | P2 | ANALYZE → CCPI | **The CCPI tab renders cached data of any age without saying it is cached.** `fromCache` and `cacheTimestamp` are written at four sites in `components/ccpi-dashboard.tsx` and read at none; `loadCCPIFromCache()` is called with no age check. `hasFreshCache` is the tool for the fix and is kept dead-but-allowlisted for it. **OPEN.** |

---

## Phase 7.4 (twelfth pass) — P7-16: the CCPI tab now dates what it is showing (2026-08-11)

Three defects in the same six lines of header, each hiding the next.

**1. The date line was wired to a field the API does not return.** The header read
`data?.lastUpdated`, and `/api/ccpi` has no top-level `lastUpdated` — the name exists only
inside each `apiStatus` source entry (`DataSourceStatus`), and `lib/ccpi/types.ts` marks
the top-level field optional. So the guard was always false and **no date rendered at
all**, on any path, fresh or cached. An optional field plus a truthiness guard is a
render that cannot fail loudly: there is no error, no empty box, just an absence nobody
can distinguish from a design decision. The field the route actually sends is `timestamp`.

**2. The cached state was tracked and never shown.** `fromCache` and `cacheTimestamp` were
written at four sites — lines 116, 150, 196, 197 — and read at none. The dashboard
restores a localStorage snapshot on load, deliberately does not refetch ("Don't auto-fetch
— only refresh when user clicks button"), and had no way to say so.

Together those two mean the tab could show a snapshot from any point in the past as
though it were current. Same family as P7-12's stale Greeks, and worse in one respect:
the Greeks panel recomputed from inputs still on screen, so a user had something to
contradict it with. A CCPI reading has no visible input at all.

**3. The subtitle asserted "Real-time market crash risk assessment".** On the most common
path — a revisit, which restores the cache and does not refetch — that was false at first
render. A label is a claim (CLAUDE.md), and this one was contradicted by the component
carrying it. The subtitle no longer asserts freshness; the timestamp line below states it,
derived from the data rather than asserted over it.

### What it says now

| State | Header |
|---|---|
| Fresh fetch | `Updated <local time>` |
| Cached, under the threshold | `Cached reading from <local time>` |
| Cached, over the threshold | `Cached reading from <local time> · over 5 min old — press Refresh for current data` |

The staleness flag is shown **only for a cached reading**, on purpose. A fresh fetch is
current by construction, and running the localStorage age check against it would report on
the stored copy rather than on what is displayed.

**The threshold is a shared constant, not a shared style.** `CACHE_FRESH_MINUTES` is
exported from `lib/ccpi/cache.ts` and read by both `hasFreshCache`'s default and the copy
that prints "over N min old". Writing `5` in the code and `5` in the sentence would have
been the label-drifts-from-the-code shape `check-provenance.ts` exists to catch — change
one and the other keeps asserting the old threshold, with nothing to notice.

### The allowlist worked as designed

`lib/ccpi/cache.ts:hasFreshCache` was in `KNOWN_DEAD` for **exactly one commit**. P7-14
kept it with no caller because it was the age check the live path was missing, and said so
in both the export's docstring and the allowlist entry. This pass wired it in, so it came
straight back off and the baseline returned to 0.

That is what the exception is for: an entry with a stated reason and a fix attached, not a
permanent carve-out. An allowlist that only ever grows is a rule being switched off one
line at a time.

### Verification

The Browser pane does not composite in this environment, so the header was not exercised
interactively. What was checked: the new subtitle and the stale-warning string are present
in the compiled client chunk under `.next/static` and the old "Real-time" copy is absent
from it; the dev server compiles and serves the page at HTTP 200 with no server errors.
**The rendered states themselves — particularly the stale branch, which needs a cached
snapshot older than five minutes — want UAT on staging.**

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-16 | P2 | ANALYZE → CCPI | **FIXED.** The header dates every reading, says when one is cached, and flags it stale past `CACHE_FRESH_MINUTES` using the `hasFreshCache` P7-14 kept for it. Two further defects surfaced in the same lines: the existing date line read `data?.lastUpdated`, which `/api/ccpi` never returns, so no date had been rendering on any path; and the subtitle claimed "Real-time" on a tab whose most common path restores a cache without refetching. |

---

## Phase 7.4 (thirteenth pass) — P7-10: the default was not where the finding said it was (2026-08-11)

P7-10 was recorded as `nvidiaMomentum: alphaVantageData?.nvidiaMomentum ?? 50` in
`/api/ccpi`. That line was real, but **it was not the source of the 50, and changing it
alone would have fixed nothing while looking like a fix.**

`fetchAlphaVantageIndicators()` does not return null when it fails. It returns a
`baselineValues` object — and that object carried `nvidiaMomentum: 50`. So on the failure
path `alphaVantageData` is truthy, `alphaVantageData?.nvidiaMomentum` is `50`, and the
`??` never fires. **A default written at the source outlives every null-guard written at
the call site**, and the guard reads as protection while protecting nothing.

The same object also carried `nvidiaPrice: 800`, `soxIndex: 5000` and
`mag7Concentration: 55`. None of those three is read anywhere — `nvidiaPrice` and
`soxIndex` come from their own AI-fallback results, and `mag7Concentration` has no reader
at all — so they were invented constants sitting exactly where a future caller would find
them and believe them. All four are now null.

### Why the display side was the live half

The row said scoring was safe and the display was unverified. Both hold, and the display
side is a real defect that fires whenever Alpha Vantage is unavailable:

- **Scoring** was already protected. `tiers.momentum.nvidiaMomentum` is
  `alphaVantageLive ? "live" : "baseline"`, and baseline inputs are excluded from the
  pillar and renormalized (P3-12). The canary path is protected too, via
  `measured(value, tier)` returning null on a baseline tier.
- **Display** read the value raw: the response's `indicators.nvidiaMomentum` is
  `data.nvidiaMomentum` with no tier gate, and `components/ccpi/pillar-momentum.tsx`
  rendered `` `$${nvidiaPrice} | ${nvidiaMomentum}/100` ``.

The reason it reaches the screen rather than being hidden is worth naming: **`nvidiaPrice`
comes from an independent AI-fallback chain**, not from Alpha Vantage. So when Alpha
Vantage is down the price is still defined, the card's `!== undefined` guards both pass,
and the row renders a real price beside a fabricated momentum — looking complete. The
card's own axis labels 40-60 as "Neutral", so a 50 reads as the measurement "NVDA is
flat" rather than "we could not measure NVDA".

### The guard change is not cosmetic

`indicators.nvidiaMomentum !== undefined` had to become `!= null`. **`null !== undefined`
is true**, so with the value now nullable the old guard would have passed and rendered the
string `"null/100"`. A nullable value and a `!== undefined` check are not the same test —
switching a field from a default to null without revisiting its guards moves a fabricated
number to a broken one.

### Scoring contract, asserted

`MomentumInputs.nvidiaMomentum` is now `number | null`, matching `soxIndex` (P6-34) and
`fearGreedIndex` (P6-18), with `null` points for a null reading. Four checks added
(formulas 533 → 537), including one that exists because the two states are otherwise
indistinguishable:

> **a 50 reading and a null are told apart by `scoredMax`, not by `score`.**

A momentum of 50 scores 0 points, and an excluded input also contributes 0. So the pillar
`score` is identical either way — only `scoredMax` (100 vs 91) records that one of them
was never measured. A test asserting `score` alone would have passed against the defect.

The null test also runs with the tier set to `live`, deliberately: the tier says where a
reading came from, the value says whether there is one, and a rule that only tests the
tier gate cannot see a null arriving on a live-tier input.

**P6-4 fixed this exact idiom for AAII eight lines above this one** and left NVDA — the
"a decision enforced in one module is not enforced" pattern, for the fifth time in this
phase.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-10 | P2 | ANALYZE → CCPI | **FIXED, and the finding's own diagnosis corrected.** The `?? 50` named in the row was never reached: `fetchAlphaVantageIndicators` returns a `baselineValues` object rather than null on failure, and *that* object held the 50 — along with three more invented constants (`nvidiaPrice: 800`, `soxIndex: 5000`, `mag7Concentration: 55`) that no code reads. All null now. Scoring was already gated by the baseline tier; the **display** rendered "$X \| 50/100" whenever Alpha Vantage was down, because `nvidiaPrice` comes from a separate AI chain and stays defined. `MomentumInputs.nvidiaMomentum` is `number \| null` with four new checks, one asserting that a real 50 and an absence are distinguished by `scoredMax` rather than by `score` — they are identical in `score`. |

---

## Phase 7.4 (fourteenth pass) — P7-17: the rest of the defaults, and a crash the null fix had already armed (2026-08-11)

P7-10 fixed one defaulted input and named the mechanism: **a default written at the
source outlives every null-guard written at the call site.** This is the sweep for the
rest of `/api/ccpi`. It found thirteen more of the same shape and, underneath them, a
client-side crash that had been sitting armed since the P6-34 nullability work.

### The thirteen

Every one is an input whose tier already reads `baseline` when its source is missing — so
scoring and the canaries excluded it correctly — while the **assembly layer substituted a
constant for the value the UI renders**:

| Pillar | Input | Was | Rendered as |
|---|---|---|---|
| Macro | `tedSpread` | `?? 0.25` | `0.25%` |
| Macro | `dxyIndex` | `?? 103` | `103.0` |
| Macro | `fedFundsRate` | `?? 5.33` | `5.33%` |
| Macro | `fedReverseRepo` | `?? 450` | `$450B` |
| Macro | `junkSpread` | `?? 3.5` | `3.50%` |
| Macro | `debtToGDP` | `?? 123` | `123.0%` |
| Macro | `yieldCurve` | `?? 0.25` | `0.25%` |
| Valuation | `spxPE` | `\|\| 22.5` | `22.5` |
| Valuation | `spxPS` | `\|\| 2.8` | `2.8` |
| Valuation | `equityRiskPremium` | derived from two defaults | `x.xx%` |
| Momentum | `vixTermStructure` | `?? 1.08` | `1.08` |
| Momentum | `qqqDailyReturn` | `\|\| 0` | `0` |
| Momentum | `qqqConsecDown` | `\|\| 0` | `0 days` |

`equityRiskPremium` is the one worth singling out. It was computed from `spxPE || 22.5`
and `yieldCurve10Y ?? 4.5`, so it could not fail to produce a number — **a derived
fabrication, further from its sources than either input and correspondingly harder to
recognise on screen as something nobody measured.** It is null-in/null-out now.

The `?? 5.33`-style constants were not arbitrary; they were plausible mid-2024 readings.
That is what makes them dangerous rather than obviously broken: a fed funds rate of 5.33%
renders exactly like a measurement, to two decimal places, on a tab whose purpose is to
tell you what the macro picture currently is.

### The crash underneath

Converting these to null meant re-reading the guards, and the guards were the finding.

`components/ccpi/*.tsx` gated every indicator on `!== undefined`. **Ten of the fields
behind those guards were already `number | null`** — `soxIndex`, `vix`, `ismPMI`,
`putCallRatio`, `aaiiBullish`, `fearGreedIndex`, `buffettIndicator`, `qqqPE`,
`mag7Concentration`, `shillerCAPE` — because P6-34 removed their baseline constants and
made `fetchWithAIFallback` return `value: null` when no provider produced a reading.

`null !== undefined` is **true**. So the guard passed, and the body ran
`indicators.soxIndex.toFixed(0)`.

That is a `TypeError`, not a wrong number. Twelve such sites. Whenever one of those
sources returned null — which is exactly what P6-34 arranged for it to do — the CCPI tab
would throw during render rather than withhold a card.

**P6-34 was right and left the other half undone.** Removing a fabricated constant and
introducing a null is only half a change; the second half is every guard and every
formatter downstream of it. This is the same pairing P7-10 flagged one commit earlier —
"a nullable value and a `!== undefined` check are not the same test" — found there on one
field and here on twelve. All 21 guards across the four pillar components are now
`!= null`, which is correct for both states.

### Verified against a live run, not just types

The local dev server has no API keys, so every source is unavailable — the exact
condition these defaults used to paper over. `/api/ccpi` now logs all four pillars
reporting `score: null` with complete exclusion lists (10 momentum, 4 risk-appetite, 7
valuation, 8 macro). Before this change the same run would have produced numbers for
`tedSpread`, `dxyIndex`, `fedFundsRate` and the rest and rendered them as readings.

The route answers 503 in that state, and did so before this change too — checked by
stashing the diff and re-requesting, so the status is pre-existing local behaviour and
not something the sweep introduced.

### The test is a loop, and that is the point

25 new checks, one per scored input, plus two scope assertions (formulas 537 → 564).

They are generated from the WEIGHTS tables rather than hand-written, because **a
hand-written list of fields to test has exactly the same blind spot as the hand-written
sweep that missed these**: it can only cover what its author remembered. Deriving from
WEIGHTS puts a new indicator in scope the moment it is given a weight.

Two details that make it a rule rather than a gesture:

- **Tiers are `"live"` throughout.** The tier gate already excludes a baseline input, so
  running the null test under baseline tiers would re-test the gate and prove nothing
  about the value path. A null arriving on a *live* tier is the case that matters: the
  tier says where a reading came from, the value says whether there is one.
- **Both the covered count and the skipped count are asserted** (P6-75, P6-77). Scope is
  structural — a weight is covered when its key is an actual field of the pillar's input
  object — so a renamed field falls into the skip list and fails the size assertion
  instead of quietly lowering coverage.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-17 | **P1** | ANALYZE → CCPI | **FIXED.** Thirteen more assembly-layer defaults on displayed CCPI inputs — the P7-10 shape across the macro, valuation and momentum pillars, including `equityRiskPremium`, which was *derived* from two defaults and so could never report an absence. All null now. **Underneath them: twelve render sites called `.toFixed()` on a `number \| null` behind a `!== undefined` guard, which is a TypeError rather than a wrong number** — armed by P6-34's nullability fix, which removed the constants and did not revisit the guards. All 21 pillar guards are `!= null`. 25 generated checks, scope asserted both ways. |
| P7-18 | P2 | ANALYZE → CCPI | **The four QQQ boolean/proximity pairs still default: `qqqBelowSMA20 \|\| false` and `qqqSMA20Proximity \|\| 0`, ×4.** "QQQ is not below its 20-day SMA" and "we could not fetch QQQ" remain the same `false`. Deliberately out of P7-17's scope: these weights score a PAIR of inputs, so the fix is a modelling decision about how a half-known technical reads, not a mechanical null-through. **`AmplifierInputs` in `lib/ccpi/scoring.ts` already models them as nullable and says why** — "`qqqDailyReturn: 0` and `qqqBelowSMA50: false` are both assertions the data never made" — so the amplifier layer got this right and the pillar layer did not. **OPEN.** |

---

## Phase 7.4 (fifteenth pass) — P7-18: "no data" and "everything is fine" were the same input (2026-08-11)

The last defaulting group in `/api/ccpi`, and the one whose consequence was largest.

Four momentum weights — `qqqSMA20` (7), `qqqSMA50` (10), `qqqSMA200` (15) and
`qqqBollinger` (9) — score a **pair** of inputs each: a boolean "is QQQ below it" and a
proximity "by how much". The route filled both halves on failure:

```
qqqBelowSMA20: qqqData?.belowSMA20 || false
qqqSMA20Proximity: qqqData?.sma20Proximity || 0
```

`smaPoints(false, 0, …)` returns **0 risk points**, and 0 points is exactly what a calm,
healthy market scores. So a completely unavailable QQQ contributed **41 of the momentum
pillar's 100 weight as "no risk detected"** — not excluded, not renormalized, but counted
as a measured all-clear on the pillar carrying 35% of the composite.

That is a different and worse failure than the rest of this phase. P7-10 and P7-17
substituted invented numbers that a reader could at least see on screen. This one made an
absence *score*, silently, in the direction of reassurance.

### The argument was already in the file

`AmplifierInputs`, one screen below `smaPoints` in the same module, models these exact
inputs as nullable and explains why:

> the amplifiers sit OUTSIDE the pillar tier system, so a baseline-tier input reached
> them as a real reading. `qqqDailyReturn: 0` and `qqqBelowSMA50: false` are both
> assertions the data never made.

**The amplifier layer got this right and the pillar layer did not**, in the same file,
about the same underlying reading. This is the "a decision enforced in one module is not
enforced" pattern for the sixth time this phase — and the first time both modules were
close enough to read in one screen.

### Why either half missing kills the pair

`smaPoints` now returns null when `below` or `proximity` is null. Not just when both are.

`proximity` alone decides two of the three branches (`>= 50` → near, `>= 25` → approach),
and `below` only participates in the third. So a known `below` with an unknown distance is
not a partial answer — it is a guess about which branch applies. Scoring it would mean
picking a band from one bit of information.

### Coverage

Fourteen checks (formulas 564 → 578): three per pair — both halves null, boolean-only
null, proximity-only null — plus a scope assertion that the pair sweep covers exactly the
weights the field-level loop skips, so the two halves of the test file cannot both stop
covering something.

The last one states the defect directly rather than testing around it:

> **QQQ fully unavailable removes all 41 pair weight rather than scoring it calm.**

Verified live as well as in unit tests: on the local dev server, where no source is
reachable, `/api/ccpi` now logs the momentum pillar excluding all ten of its inputs
including the four pair keys. Before this change those four would have been absent from
the excluded list and present in `scoredMax`.

With P7-18 closed, **every scored CCPI input is nullable and every one is asserted to
exclude when null** — 25 field-level cases plus 4 pair cases, 29 of 29 weights.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-18 | **P1** | ANALYZE → CCPI | **FIXED.** The four QQQ moving-average/band weights filled both halves of their input pair with `\|\| false` and `\|\| 0`, and `smaPoints(false, 0, …)` returns 0 risk points — **the same score a calm market earns.** An unavailable QQQ therefore contributed 41 of the momentum pillar's 100 weight as a measured all-clear, rather than being excluded and renormalized. Worse than the invented numbers of P7-10/P7-17: this absence *scored*, invisibly, toward reassurance. Both halves are nullable and either one missing makes the pair unscoreable, because `proximity` alone decides two of `smaPoints`' three branches. `AmplifierInputs` in the same module already modelled these as nullable with the reason written out. 14 checks; all 29 scored weights are now asserted to exclude on null. |

---

## Phase 7.4 (sixteenth pass) — the crash class becomes a rule, and the sweep leaves /api/ccpi (2026-08-11)

Two jobs: make P7-17's crash impossible to rewrite, then run the same lens over the other
59 routes.

### P7-19 — `scripts/check-null-guards.ts`

The rule: **no formatter call is guarded only by `!== undefined`.**

It matches `X.toFixed(` / `toPrecision` / `toLocaleString` / `toExponential` on a member
expression, then asks whether that same expression is anywhere null-tested in the file. A
`!== undefined` guard with no null test is a failure.

It is deliberately a **uniformity rule, not a bug detector**. `!= null` is never wrong;
`!== undefined` is sometimes catastrophically wrong. Requiring the former everywhere means
no reader — and no future edit — has to know which fields are nullable *today*. The
alternative needs type information to decide, which is a rule nobody can apply while
writing the code.

**What it found on introduction, stated honestly: four sites, none of them a crash.**
`data.latestCitiReading` in panic-euphoria and `stock.premium` / `stock.annualizedYield` /
`stock.iv` in the strict scanner table are all declared `?: number` — genuinely optional,
never null — so `!== undefined` was the correct test on the day each was written. They
were converted for conformance. Reporting them as four more defects would be inventing a
result.

That is the argument for turning it on now: the twelve real crashes were fixed by hand in
P7-17, and this exists so the thirteenth cannot be written. **A rule introduced while it
still finds live bugs is a rule introduced too late.**

Limits are in the file header rather than implied: it cannot follow a value passed into a
child component and formatted there, nor one reached through a local alias. It catches the
idiom this codebase writes — guard and format in one JSX block. Scope is structural (95
`.tsx` files under `components/` and `app/`), and both the file count and the number of
formatter calls examined are asserted, so a matcher that stops matching fails instead of
reporting a clean sweep.

### P7-20 — the absence was narrated to the model as an all-clear

The survey's first hit was not a display defect. `/api/ccpi/executive-summary` built its
prompt with `const ccpi = body.ccpi ?? 0`, and rendered it as:

```
- CCPI Score: ${ccpi}/100
```

directly beneath its own legend:

```
- 0-19: Low Risk (markets healthy)
```

So a composite that **could not be scored** — which, after P7-17 and P7-18, is exactly
what a data outage now produces — was handed to the model as the strongest all-clear the
scale has. The model's answer is what the user reads as the executive summary. This is
P6-19's defect one level up: that fix taught `pillarLine` to print "insufficient data"
instead of a number, and left the composite the pillars roll up into.

**Three layers all produced the zero, and the outermost made the others unreachable.**
`components/ccpi-dashboard.tsx` sent `ccpi: Math.round(ccpiData.ccpi)` — and
`Math.round(null)` is `0`, so the route's `?? 0` never fired and would not have mattered
if it had. `certainty || 0` did the same. Fixing only the route would have changed
nothing, which is the P7-10 lesson exactly: a default at the source outlives every guard
at the sink.

Both ends now pass null through, and the prompt states the absence in terms the model
cannot round off:

> **NOT SCOREABLE** — too little of the index was backed by live data to compute a
> composite. Do NOT infer a level, a regime, or a direction from its absence, and do not
> treat it as low risk.

Two smaller instances went with it. `${certainty}%` appeared three times and would have
rendered "null%". And the task instruction branched on `certainty >= 70` / `>= 50` — both
false for null — so an absent certainty fell through to "low signal consistency —
significant uncertainty", an assertion about signal agreement that nothing measured, in
the same voice as a real reading. Both branches now say the score was unavailable instead
of characterising it.

### P7-21 — what the survey found in the other 59 routes

Sixty route files, 25 numeric-default sites across 10 of them. Most are benign and stay:
sort comparators (`(b.marketCap ?? 0) - (a.marketCap ?? 0)` is a tie-break, not a
reading), accumulator seeds, and a wing-width floor.

Four groups are the P7-10 shape and are **recorded rather than changed**, because each
needs its own display-path verification and one of them sits under an open owner decision:

| Route | Sites | Why it matters |
|---|---|---|
| `/api/sentiment-heatmap` | `bullishScore \|\| 50`, `bearishScore \|\| 50`, plus **three whole-object returns of `{bullishScore: 50, bearishScore: 50, netSentiment: 0}`** on AI failure, unparseable JSON, and exception | A fabricated neutral sentiment on a 0-100 scale. Touches **P6-11**, which is an open owner decision, so it is not rewritten here. |
| `/api/trend-analysis` | `regularMarketPrice \|\| 0`, `regularMarketChange \|\| 0`, `regularMarketChangePercent \|\| 0`, two volume fields | **A price of 0 is not a price.** It also feeds the indicator maths, so the consequence is not confined to the display. |
| `/api/strategy-scanner` | `STOCK_BETAS[ticker] \|\| 0.7` | The table itself is ~25 hardcoded betas with no source and no date — a P3-19-class static input to risk math — and unknown tickers get 0.7. Needs a decision (fetch beta, or label the table static), not a null-through. |
| `/api/polygon-tickers` | `prevDay?.v \|\| snapshot.day?.v \|\| 0`, price `\|\| 0`, `market_cap \|\| 0` | Same "0 is not a measurement" question, on the ticker universe the scanners filter from. |

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-19 | P2 | tooling | **`scripts/check-null-guards.ts` added and wired into `check:formulas`.** No formatter call may be guarded only by `!== undefined`, the idiom behind P7-17's twelve TypeErrors. A uniformity rule by design: `!= null` is never wrong and `!== undefined` sometimes is, so no reader must know which fields are nullable today. **The four sites it found were conformance, not crashes** — all `?: number` — and saying otherwise would be inventing a result. |
| P7-20 | **P1** | ANALYZE → CCPI | **FIXED.** `/api/ccpi/executive-summary` narrated an unscoreable composite to the model as `CCPI Score: 0/100`, under its own legend reading "0-19: Low Risk (markets healthy)" — the absence presented as the strongest all-clear, in the text a user reads as the summary. P6-19 fixed the pillars and left the composite. **Three layers produced the zero**, and the client's `Math.round(null)` made the route's guard unreachable, so both ends are fixed together. Also: `${certainty}%` would have printed "null%", and the `certainty >= 70` / `>= 50` branches both being false made an absent certainty read as "low signal consistency". |
| P7-21 | P2 | site-wide | **The `??`/`\|\|` default survey across the other 59 routes: 25 sites in 10 routes, of which four groups are real.** `/api/sentiment-heatmap` returns a fabricated 50/50 neutral on three separate failure paths (touches open P6-11); `/api/trend-analysis` defaults price, change and volume to 0 and feeds the indicator maths; `/api/strategy-scanner` carries ~25 sourceless hardcoded betas plus `\|\| 0.7`; `/api/polygon-tickers` zeroes price, volume and market cap. The rest are sort comparators and accumulator seeds and stay. **OPEN** — each needs its own display-path check, and one is blocked on an owner decision. |

---

## Phase 7.4 (seventeenth pass) — P7-21's two unblocked routes (2026-08-11)

The two of P7-21's four groups that need no owner decision. Both turned out to be
**different failures wearing the same `|| 0`**, which is the reason they were worth
reading individually rather than sweeping.

### `/api/trend-analysis` — one of the five defaults mattered

`meta.regularMarketPrice || 0`, `regularMarketChange || 0`,
`regularMarketChangePercent || 0`, and two volume fields.

**Only the price was a defect, and the rest are left deliberately.**

- The **volumes** are recovered downstream: about forty lines on, the caller replaces a
  zero `currentVolume` from the last ten historical bars and computes `avgVolume` from
  history when it is zero. There, 0 is a handled sentinel with a recovery path, not a
  reading. Nulling it would have broken working code to satisfy a pattern.
- The **change** fields have their own recovery immediately below: `if (change === 0 &&
  currentPrice > 0)` derives the move from `previousClose`, then from the last two
  historical closes.
- The **price** has no recovery, and worse, it *suppresses* one. The caller reads
  `quote ? quote.regularMarketPrice : lastBar.price` — so a quote object that merely
  CONTAINS a zero takes the stored-bar fallback off the table. The zero then reaches both
  the indicator maths and the display.

`fetchYahooQuote` now returns `null` when the price is not a usable positive number, which
routes the symbol to `lastBar.price` — the path the code already wanted. The function's
contract already included null (two other branches return it), so no caller changed.

### `/api/polygon-tickers` — the default was making a filter decision

`prevDay?.v || day?.v || 0`, `prevDay?.c || day?.c || 0`, and
`results?.market_cap || 0`.

Not a display defect. These feed filters — and that is worse in a specific way, because a
0 did **two contradictory things at once**:

- compared against `minVolume` and `minMarketCap`, an unmeasured ticker was **silently
  dropped** whenever those minimums are above zero;
- compared against `maxPrice`, the same unmeasured ticker **passed**, because `0 <=
  maxPrice` is true.

So "we have no reading for this ticker" was resolved as a rejection by one filter and an
acceptance by another, in the same loop, and then shipped in the response as `price: 0`
for whatever survived.

Neither outcome is a filter decision anyone made. Unknown snapshots are now skipped
explicitly and **counted**, and the count ships as `unmeasuredSnapshots` on the response —
P6-32's rule, the one that gave the CCPI its `suppressedCanaries` list: *a short list and
a short list with N inputs suppressed are very different states, and they used to produce
the identical response.*

Dropping an unmeasured ticker is very likely the right call for a screener. The point is
that it is now a stated rule with a visible count, rather than an emergent property of
`|| 0`.

### Still open under P7-21

`/api/sentiment-heatmap`'s three fabricated 50/50 returns — blocked on **P6-11**, an open
owner decision — and `/api/strategy-scanner`'s ~25 sourceless hardcoded betas plus
`|| 0.7`, which needs a decision (fetch beta, or label the table static) rather than a
null-through.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-21 | P2 | site-wide | **Two of four groups fixed; two remain, both needing a decision rather than code.** `/api/trend-analysis`: of five `\|\| 0` defaults only the PRICE was a defect — the volumes and change fields have real recovery paths a few lines down, while a zero price suppressed the `lastBar.price` fallback the caller already had and fed the indicator maths. Now returns null. `/api/polygon-tickers`: the zeros were filter inputs, and one unmeasured ticker was **dropped by the volume/market-cap minimums and simultaneously passed by the max-price test** — then shipped as `price: 0`. Unknown snapshots are skipped and counted, with `unmeasuredSnapshots` on the response (P6-32). **STILL OPEN:** sentiment-heatmap's 50/50 (blocked on P6-11) and strategy-scanner's static beta table. |

---

## Phase 7.5 — the standing guard, and the rule that had drifted (2026-08-11)

Step 7.5 asks for a standing regression guard and names the gap exactly:

> Keep `pnpm check` green; monthly health review via the Admin page. Re-run the doc-figure
> sweep whenever a weight table, a route count or a data path changes — the ceilings are
> pinned (`scripts/ccpi-certainty-ceiling.ts`) but **prose figures elsewhere are not**.

So the buildable part of 7.5 was the sweep the plan describes doing by hand, turned into
`scripts/check-doc-figures.ts` and wired into `check:formulas`.

### It was not hypothetical, and the stale figure was in the rule about staleness

CLAUDE.md's verification section — the one that tells the next session to **count the PASS
lines, because a script that stops running is indistinguishable from one that passes** —
read `Current baselines: formulas 514`. The suite was at 581 by the time this session
started closing P7-17 and P7-18.

A rule that quotes a stale number teaches the reader to expect the wrong thing, and this
is the rule whose whole job is catching silent breakage. Someone following it exactly
would have seen 581, compared it to the documented 514, and had no way to tell a suite
that grew from a suite that broke.

### Derived vs pinned, and why the difference is stated rather than smoothed over

Five figures are covered, and they are not equally trustworthy:

- **Derived (2):** the route count is counted from `app/api` on disk; the contract count
  from `lib/api-contracts.ts`. These are compared against reality, and a third assertion
  requires them to agree with each other.
- **Pinned (3):** `formulas`, `remediation` and `typecheckKnown` are PASS/error counts
  that only a full run produces. This check cannot derive them without executing the
  suite it is part of. So the doc figure must equal a constant in the script, and the two
  have to move in the same commit.

Pinning is weaker than deriving and the file says so instead of hiding it behind a
variable name. It converts "the doc drifted and nobody noticed" into "the doc and the
constant disagree, loudly" — the same trade `KNOWN_DEAD_BASELINE` makes, for the same
reason.

**A figure that disappears from the prose fails too.** If the pattern stops matching, that
is a FAIL, not a silent skip: deleting the number is how a load-bearing rule stops being
load-bearing, and it would otherwise be the easiest way to make this check green.

### The check caught its own bug first

The first version counted contracts with `/^\s*path:/gm` and reported **51 against the
suite's authoritative 60**. Nine contracts are written inline — `{ path: "/api/x", method:
… }` — with the key after the brace, so the line-anchored pattern missed them.

That is worth recording rather than quietly fixing, because **a derivation that undercounts
is worse than no derivation**: it asserts a wrong figure with a PASS beside it, which is
the exact failure mode this audit exists to remove. What caught it was the parity
assertion — routes on disk must equal contracts declared — which exists precisely so a
count cannot be wrong on its own.

### And it moved the number it pins

Wiring the check in raised the formulas count from 581 to 590, because its own PASS lines
are part of the suite it measures. That is not a quirk to engineer around; it is the
guard working. Any future check will do the same, and the failure message will name the
figure that needs updating.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-22 | P2 | tooling / docs | **Phase 7.5's standing guard: `scripts/check-doc-figures.ts`, wired into `check:formulas`.** CLAUDE.md's "count the PASS lines" rule carried `formulas 514` against a suite at 581 — **the stale figure was inside the rule about staleness**, so following it exactly could not distinguish a suite that grew from one that broke. Two figures are DERIVED (route count from disk, contract count from `lib/api-contracts.ts`, plus a parity assertion between them) and three are PINNED to a constant, with the difference stated rather than smoothed over. A figure vanishing from the prose fails rather than skipping. **The parity assertion caught the check's own first-draft undercount (51 vs 60) before it shipped.** |

---

## Phase 7.4 (eighteenth pass) — S-18: the step numbers, and what the drift actually was (2026-08-11)

The row said "buttons, card headings and error strings disagree about which step is
which," measured at 90 literal `Step N` strings across nine files. Both halves needed
checking before anything was changed, and both turned out to be **partly** right.

### The canonical order was never in doubt

`step1-dollar-filter-card.tsx` … `step4-technical-card.tsx` declare it, and their
headings agree with the buttons and the notices:

| Step | Card heading | Action |
|---|---|---|
| 1 | Dollar Amount Filtering | the price-ceiling slider — a filter, not a click |
| 2 | Smart Pre-Filtering | Scan for Potential Stocks |
| 3 | Fundamental Criteria | Scan Fundamentals |
| 4 | Technical Criteria | Run Technical Analysis, incl. the relaxed flow |

### The drift was real, and one instance reached a user

`loadPreFilteredTickers` is the handler behind the button reading **"Scan for Potential
Stocks (Step 2)"**. On failure it did:

```
setError(`Step 1 failed: ${err.message}`)
```

**A user clicks the Step 2 button, it fails, and the error names Step 1.** Its two console
logs said Step 1 as well.

Alongside that, in the same file: the technical-analysis handler logged itself as
`Step 3` five times against its own Step 4 button and card, and a comment called the
fundamental scan `Step 2`. So within one file the fundamental scan was called Step 2 and
Step 3, and technical analysis was called Step 3 and Step 4.

**But the claim about card headings was not true today.** The four headings, the buttons
and `scanner-notices.tsx` all agreed with each other and with the canonical order. The
disagreement was between the UI and the handler behind it — which is harder to notice,
because the two are never read side by side.

### What was changed, and what was left

`components/scanner/steps.ts` is now the single declaration, and the twelve label sites
in the hook plus the headings, buttons and explanatory copy in the five UI files are
derived from it. **Every rendered string was diffed against its original before and
after** — all identical, except the two that were wrong:

- `Step 1 failed:` → `Step 2 failed:`
- `Please complete Step 3 first (Scan Fundamentals)` → `Please complete Scan Fundamentals
  (Step 3) first` (same number; reworded so the label comes from one place)

`scripts/check-scanner-steps.ts` holds it: no literal step number in a `setError` anywhere
in the guarded set, and none in a rendered label in the `.tsx` files.

**Left alone, deliberately, and the check says so rather than implying completeness:**

- **Comments and `console.log` strings.** Dozens remain in scanner internals. Several are
  prose about the pipeline rather than labels — "Step 4 is where a missing chain shows
  up" — and converting them would trade a readable comment for an interpolation with no
  reader-visible gain. **S-18 stays open for these**, measured rather than declared done.
- **`wheel-strategy-planner.tsx` and `options-strategy-toolbox.tsx`.** These number steps
  1-4 too: Sell Cash-Secured Puts, Get Assigned, Sell Covered Calls, Repeat. That is the
  wheel STRATEGY lifecycle — a different sequence that happens to share the phrasing.
  Folding it into one registry would force "Step 3" to mean both "Fundamental Criteria"
  and "Sell Covered Calls", which is worse than the duplication it removes.

### The check caught its own false positive

The first draft filtered `console.` line by line and flagged three multi-line
`console.log` calls in `use-wheel-scanner.ts` — their continuation lines carry the step
number but not the `console.` token. A line-based filter cannot see a call that spans
lines.

The fix is structural rather than a better filter: the rendered-label assertion runs only
on `.tsx` files, because **JSX cannot exist in a `.ts` file, so a rendered label cannot
either**. `.ts` files stay covered by the `setError` assertion. Formulas 590 → 607.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| S-18 | P2 | SCAN → scanner | **Drift fixed and guarded; the literal sweep stays open.** The claim about card headings did not hold — headings, buttons and notices all agreed. The real disagreement was between the UI and its own handler: `loadPreFilteredTickers` sits behind the "Scan for Potential Stocks (Step 2)" button and set the error **"Step 1 failed"**, while the technical handler logged "Step 3" against its Step 4 button and a comment called the fundamental scan "Step 2". `components/scanner/steps.ts` is now the single source for every rendered label and every `setError`, enforced by `scripts/check-scanner-steps.ts`; each converted string was diffed against its original and only the two wrong ones changed. **Still open:** dozens of `Step N` mentions in comments and console logs, deliberately not converted, and the wheel-STRATEGY lifecycle (Sell Puts / Get Assigned / Sell Calls / Repeat), which is a different sequence and must not share the registry. |

---

## Phase 7.4 (nineteenth pass) — S-18 closed, and the hand-written guard list was the bug (2026-08-11)

The previous pass fixed the drift and guarded six files. Finishing the sweep found that
**the guard itself had the weakness it was written to replace.**

### A hand-written file list covers what its author remembered

`GUARDED` was six paths, typed out. It therefore did not cover:

- `scanner-notices.tsx` — **eight user-visible step labels**, including three card titles
- `fundamental-results-table.tsx`, `relaxed-results-table.tsx`, `strict-results-table.tsx`
  — four more rendered titles between them

That is the same failure as the hand sweep the check replaced: a list can only contain
what someone thought of. The scope is now **derived** — every `.tsx`/`.ts` under
`components/scanner/` except `steps.ts` itself, plus `components/wheel-scanner.tsx` — so a
new scanner file is in scope the moment it exists. Seventeen files, size asserted.

### A second file was lying about which step it was

`components/scanner/fundamental-scan.ts` opens with `// Step 3 fundamental scan core` and
takes the fundamental filter parameters. It logged itself as **Step 2**, twice:

```
[v0] Step 2: Scanning ${tickers.length} stocks with Polygon API
[v0] ✅ Step 2 Complete with REAL Polygon data: …
```

Same shape as the `Step 1 failed` defect from the previous pass, in a different file, and
it would not have been found by looking at the UI — the file's header, its card and its
logs each named a different step.

### One that looks wrong and is right

`use-wheel-scanner.ts` annotates `minMarketCapCategory` as the "Step 3 market-cap floor"
while it indexes `PRE_FILTER_MARKET_CAP_TIERS`, which `constants.ts` calls "the Step 2
pre-filter slider". Both comments are correct: **the ladder is shared** between a Step 2
universe slider and a Step 3 fundamental floor, and the step 3 card renders "Market Cap
Floor (Step 3)" alongside text explaining it is "independent of the Step 2 universe
filter". Left exactly as it is. Rewriting it to look consistent would have made it wrong.

### Comments are out of scope for a reason, not as a concession

A comment cannot interpolate a constant — there is no expression to evaluate — so no
check can source one, and rewriting prose into code would be worse for the only audience
comments have. Instead **every remaining comment mention was read by hand against the
canonical order.** Two were wrong and are corrected; one is the shared-ladder case above;
the rest were already right.

That is the honest end state: the machine holds every string a user or a log reader sees,
and a human verified the prose once. Claiming a check covers comments would be claiming
something no check can do.

### Every converted string was diffed

Twenty-three conversions across nine files, each rendered and compared to its original.
All identical except the two `fundamental-scan.ts` logs, which correctly changed Step 2 →
Step 3. Formulas 607 → 622.

**A near-miss worth recording:** one `check:formulas` run reported **537** rather than 622
— a transient, because the run overlapped an edit to `check-doc-figures.ts` and read the
file mid-write. The number was about to be pinned as the new baseline. What caught it was
that 537 is exactly the running total through `ccpi-certainty-ceiling`, which looks like a
chain that halted rather than a suite that shrank. **The PASS count is the thing CLAUDE.md
tells you to trust, and it can still lie if you measure it while the tree is moving** —
re-run before pinning.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| S-18 | P2 | SCAN → scanner | **CLOSED.** Every step label a user or log reader sees now derives from `components/scanner/steps.ts`; the guard's scope is derived from the directory rather than hand-listed, which is what exposed the four unguarded files (`scanner-notices.tsx` alone carried eight rendered labels). **A second drifting file surfaced: `fundamental-scan.ts` logged itself as Step 2 under a header reading "Step 3 fundamental scan core".** Comments stay out of scope because a comment cannot interpolate a constant — each was instead verified by hand, and the one that looks contradictory (`minMarketCapCategory` as a "Step 3 floor" indexing the Step 2 ladder) is correct, because the ladder is shared. 17 files guarded, 32 assertions. |

---

## Phase 7.4 (twentieth pass) — re-verifying this session's closures, and the gap it found (2026-08-11)

`fixed` in the ledger means the record says so, not that anyone re-read the code. So this
pass re-read the code.

### 68 claims, checked against the source rather than the record

Every closure from this session — P7-9, P7-12, P7-14, P7-16, P7-17, P7-18, P7-20 — was
re-asserted directly: that each of the 22 nulled inputs is actually `?? null` in the
route, that each has a matching `=== null` branch in the scoring core, that `smaPoints`
refuses either half, that the executive-summary prompt has no bare `${ccpi}/100`, that the
Greeks component no longer declares its own `normalCDF`, that the deleted modules are gone
and nothing still imports them.

All 68 hold.

**One reported a MISS and was my verifier's fault**, which is worth recording because it
is the third instance of the same trap in one session: the assertion "the subtitle no
longer claims real-time" matched the phrase inside the **JSX comment documenting its
removal**. `check-dead-exports.ts` had to be excluded from its own scan for the same
reason, and `check-scanner-steps.ts` needed the `.tsx`-only rule for a cousin of it. A
check that names what it looks for will find its own name.

### The guards were tested by breaking things on purpose

A check that has never failed is indistinguishable from one that cannot fail. Each new
rule was given a violation to catch, then reverted:

| Injected | Caught by |
|---|---|
| literal `Step 4` back into a results-table title | `check-scanner-steps` |
| one `!= null` guard reverted to `!== undefined` | `check-null-guards` |
| CLAUDE.md's baseline set back to the stale 514 | `check-doc-figures` |
| a live `lib/` export renamed so its caller breaks | `check-dead-exports` |

All four failed as intended and went green on revert.

### The one that nothing caught

Then `tedSpread ?? 0.25` — the exact P7-17 defect — was put back into the route, and the
**entire suite passed.**

Not the scoring tests: they exercise `computeMacroPillar`, which is handed a number and
cannot know it was invented one function earlier. Not `check-provenance`: it reads UI
copy. The tier still says `baseline`, which correctly excludes the value from SCORING —
and the display reads the raw value, which is where the fabrication lands. **The defect
lives in the gap between the two, so nothing that inspects either end can see it.**

Twenty-two instances fixed across three passes, and no guard against the twenty-third.
That is precisely what re-verification is for, and it is a more useful result than
confirming the fixes.

### P7-23 — the ratchet that closes it

`scripts/check-ccpi-defaults.ts`: no scored CCPI input may be assembled with a literal
default. Field list **derived from the WEIGHTS tables** — the same tables the scoring core
uses — so an indicator is guarded the moment it is given a weight; the four SMA/Bollinger
pair weights are expanded to their eight real field names, and both counts are asserted.
33 fields checked.

**This is a ratchet, not the sweep AUDIT_PLAN warns against.** 7.4 says: *"Do not sweep
for `|| <const>` — it found the early Phase 6 defects and missed every one of the
fifty-one."* That is guidance about DISCOVERY, and it is correct — as a search this
pattern is nearly worthless. Over a known, enumerated field set it is the opposite: it
cannot find anything new, and it cannot let a fixed one come back.

Negative-tested in all three forms the removed defaults actually took — `?? 0.25`,
`?? 50`, `|| false` — each caught, each green on revert.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-23 | P2 | tooling | **The P7-10/P7-17/P7-18 class had no standing guard.** Re-verification put `tedSpread ?? 0.25` back into `/api/ccpi` and the whole suite passed: the scoring tests see a number and cannot know it was invented upstream, `check-provenance` reads UI copy, and the tier correctly says "baseline" while the display reads the raw value — **the defect lives in the gap between them.** `scripts/check-ccpi-defaults.ts` closes it, with the field list derived from the WEIGHTS tables and negative-tested against all three default forms. A ratchet over an enumerated set, not the discovery sweep AUDIT_PLAN 7.4 warns against. |

---

## Phase 7.4 (twenty-first pass) — hunting unguarded classes, and a bug in the checks themselves (2026-08-11)

P7-23 came from asking "what would catch this if it came back?" This pass asked it of
every other fix closed today.

### Three classes were unguarded; the evidence is a passing suite

Each fix was reverted in place and the full suite run:

| Reintroduced defect | Caught by |
|---|---|
| `body.ccpi ?? 0` in the executive-summary prompt (P7-20) | **nothing** |
| a local `normalCDF` in the Greeks calculator (P7-12) | **nothing** |
| deleting the cache-age header render (P7-16) | **nothing** |

The last two appeared to fail at first — one FAIL each — but the failing line was
`SITE_MAP.md is up to date`, triggered by the line counts moving. **Incidental, not
detection:** run `pnpm inventory` as the workflow already requires and both pass. Worth
recording because "the suite went red" is exactly the kind of evidence that looks
sufficient and is not.

### P7-24 — the house rule that had no check

CLAUDE.md says: *"Indicators come from `lib/indicators.ts`; option math from
`lib/black-scholes.ts` — never re-implement locally."* Nothing enforced it, and it had
been broken twice — P7-12's local `normalCDF`/`normalPDF`/`calculateGreeks`, and P7-13's
inline expected-move formula. **A house rule with no check is a suggestion.**

`scripts/check-house-libs.ts` reads the two libraries' own exports (21 names) and fails on
any *declaration* of one of those names elsewhere. The discrimination that matters:
`const rsi = calcRSI(prices)` is correct usage and must pass, while `const rsi = (…) => …`
and `function rsi(…)` are re-implementations. Keying on the declaration FORM separates
them — which is also why `check-dead-exports`' long-standing NOTE listing `rsi`, `macd`
and `atr` as collisions was correctly a non-finding.

Its limit is stated in the file: P7-13's `price * ivData.atmIV * Math.sqrt(1/365)` has no
name to match, so nothing structural can see it.

### The part that matters most: the checks were scanning a truncated file

The arrow-function negative test **did not fail when it should have.** Chasing that found
a bug in the `stripComments` helper shared by four checks.

Line 5 of `components/wheel-scanner.tsx` reads:

```
// results tables live in components/scanner/*. This file only composes them —
```

The `/*` in that glob path was treated as a **block-comment opener**. The stripper ran
block comments first, so it consumed everything from there to the next `*/` — about
seventy lines of that file — and every check using the helper scanned the remainder while
reporting **PASS on a file it could not see**.

`check-scanner-steps` guards that exact file. `check-null-guards` and `check-house-libs`
scan it. Their green was partly hollow.

The fix is one pass with alternation, so whichever comment form appears first in the text
wins — at a `//` the line form matches, at a `/*` the block form does. Applied to all four
copies. The blast radius was measured rather than assumed: one file today, and it would
have silently grown with any future `/*` inside a line comment.

**This was only found by deliberately injecting a violation and noticing it was not
caught.** A check that has never failed is indistinguishable from one that cannot fail —
and here, one of them genuinely could not, for one file, invisibly.

### Still unguarded, and recorded as such

P7-20's class (a fabricated value interpolated into an AI prompt) and P7-16's class (state
written and never read) have no rule. Both are checkable in principle; neither is
attempted here rather than shipped half-built, which is the failure mode this phase keeps
finding.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-24 | P2 | tooling | **`scripts/check-house-libs.ts` added: CLAUDE.md's "never re-implement locally" rule had no enforcement**, and had been broken twice (P7-12, P7-13). Reads the two libraries' 21 exported names and fails on any declaration of one elsewhere, distinguishing a re-implementation from correct usage by declaration form. **Building it exposed a bug in the shared `stripComments` helper: a `/*` inside a LINE comment (a glob path, `components/scanner/*.`) was read as a block-comment opener and swallowed ~70 lines of `components/wheel-scanner.tsx` from four checks' scans — they reported PASS on a file they could not see.** Fixed in all four; found only because an injected violation failed to fail. |
| P7-25 | P3 | tooling | **Two fix classes from this session remain unguarded, verified by reverting each and watching the suite pass:** a fabricated value interpolated into an AI prompt (P7-20's `ccpi ?? 0`), and component state written but never read (P7-16's cache-age header). Two apparent catches were incidental — `SITE_MAP.md is up to date` firing on moved line counts, which `pnpm inventory` clears. **OPEN**, and deliberately not half-built. |

---

## Phase 7.4 (twenty-second pass) — P7-25's two guards, and six tabs that never say whether their data is live (2026-08-12)

The two classes P7-25 recorded as unguarded. Both are now rules; building them found a
new provenance family and two more bugs in my own matchers.

### P7-25a — no fabricated value reaches a prompt

`scripts/check-prompt-inputs.ts`. In any file that reaches a model, a variable declared
with a literal `??`/`||` fallback must not be interpolated into a prompt template.

**This class is worse than a fabricated number on screen.** A wrong figure in the UI is at
least inspectable. A wrong figure in a prompt is *reasoned over*, and what reaches the
user is prose that no longer contains the number — nothing downstream can recover the
fact that the input was invented. P7-20's `?? 0` became "markets healthy" in an executive
summary.

**Two bugs in the rule, both found by injecting the verbatim P7-20 defect and watching
nothing happen:**

1. Prompt bodies were extracted with `indexOf("`")` on the assumption that these templates
   contain no nested backticks. **They do** — inside their own `${…}` expressions. The
   body was truncated at the first inner tick, well before the interesting line. Replaced
   with a nesting-aware scan that tracks `${…}` depth.
2. The prompt-name pattern was `[A-Za-z_$][\w$]*[Pp]rompt`, which requires a PREFIX
   before "prompt". It matched `systemPrompt` and `userPrompt` and **never matched a bare
   `const prompt`** — which is precisely where P7-20 lived. The rule reported "5 prompt
   templates found", passed, and covered none of the files that mattered. Fixed:
   **11 prompts**, more than double.

Both were silent under-coverage that a PASS line hid, which is the failure this phase
keeps re-finding. Neither would have surfaced without the injection test.

### P7-25b — component state written and never read

`scripts/check-write-only-state.ts`. For every `const [x, setX] = useState(…)`, `x` must
appear somewhere other than its own declaration. **Calling `setX` is writing, not
reading.**

346 pairs examined, **14 write-only**, and the distribution is the finding: the values
that go unread are disproportionately the ones describing *where the data came from and
how old it is*.

**Six scanners set `isLiveData` from real payload data and render it nowhere** —
butterfly, calendar-spread, credit-spread, iron-condor, leaps and zebra. Each one knows
whether its numbers are live and does not say. `leaps-scanner.tsx` is representative:
`setIsLiveData(data.isLive || false)` at line 140, no read anywhere. The component
computes its own honesty and discards it.

**`components/market-sentiment.tsx` carries the P7-16 trio verbatim** — `lastUpdated`,
`fromCache`, `cacheTimestamp`, all written, none read. That is the same defect fixed in
`ccpi-dashboard.tsx` this session, still live in a second component. Fixing one instance
of a pattern is not fixing the pattern.

Ratcheted at 14 rather than swept, each entry annotated with what it actually is — the
`check-dead-exports` precedent. One is explicitly *not* a concealment:
`insider-trading-dashboard.tsx:dataSource` is redundant, because that dashboard renders
provenance from `data.dataSources` instead. Three more are not yet individually diagnosed
and say so.

**Neither guard's findings are fixed here.** Rendering a live/cached badge on six scanner
tabs and a timestamp on market-sentiment is user-visible copy that needs
`check-provenance` review and UAT — a change, not a cleanup.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-25 | P3 | tooling | **FIXED.** Both classes are now rules: `check-prompt-inputs.ts` (no defaulted value interpolated into a prompt — the P7-20 class, where a fabrication is reasoned over and disappears into prose) and `check-write-only-state.ts` (346 `useState` pairs, 14 write-only, ratcheted). **Building the first exposed two silent under-coverages in it**: prompt bodies truncated at a nested backtick, and a name pattern requiring a prefix that never matched a bare `const prompt` — the rule reported 5 prompts where there are 11, and covered none of the files it existed for. Both found only by injecting the verbatim P7-20 defect. |
| P7-26 | **P1** | SCAN → six scanners, ANALYZE → Market Sentiment | **Six scanner tabs know whether their data is live and never say so.** `isLiveData` is set from real payload data in butterfly, calendar-spread, credit-spread, iron-condor, leaps and zebra, and rendered in none of them — so a user cannot tell a live scan from a stale or synthesized one on any of them. Separately, **`market-sentiment.tsx` carries P7-16's `lastUpdated`/`fromCache`/`cacheTimestamp` trio verbatim**, written and never read, so that tab can show a cached snapshot of any age with nothing on screen dating it. Found by `check-write-only-state.ts`; ratcheted, not swept. **OPEN** — the fix is user-visible copy on seven tabs and needs provenance review and UAT. |

---

## Phase 7.4 (twenty-third pass) — P7-26 fixed, and half of it was my own mistake (2026-08-12)

P7-26 was recorded as "six scanner tabs know whether their data is live and never say
so." **That framing was wrong, and going to fix it as written would have re-introduced a
P1.**

### What `isLiveData` actually was

`/api/strategy-scanner` does not emit `isLive`. **P1-10 removed it** — the boolean meant
"a Polygon key is configured" and was drawn as a green LIVE badge over numbers the route
itself describes as *"black-scholes model output (derived, not a tradeable quote)"*. The
success payload now carries `provenance`, `assumptions` and `dataSource` instead.

So `data.isLive` has been `undefined` on every successful response since, and
`setIsLiveData(data.isLive || false)` wrote `false` forever.

**The six scanners were not concealing a signal. They were reading a field that no longer
exists**, and all six already disclose provenance through the shared
`<PricingProvenance />` component. Had the finding been fixed as written — "render the
flag" — the result would have been a badge asserting liveness over model output, which is
precisely the claim P1-10 deleted. The fix is deletion.

### What the check actually found, which was worse

Three components were NOT in the write-only list, because they *do* read the flag —
`earnings-plays-scanner`, `high-iv-watchlist`, `wheel-strategy-screener`. They render:

```
isLiveData ? <green "LIVE"> : rows.length > 0 ? <yellow "Cached"> : null
```

With `isLiveData` permanently false, **every freshly-fetched scan was labelled "Cached"**
— a false provenance claim in the opposite direction, on three public tabs, and none of
these three renders `<PricingProvenance />` to offset it.

The badge now states what the component genuinely knows: whether the rows on screen came
from `localStorage` or from a fetch in this session. It does not say "live".

**A second bug, mine, caught before commit.** The first rewrite was
`{!fromCache ? (Fetched) : rows.length > 0 ? (Cached) : null}` — which renders "Fetched
this session" on first mount with zero rows, before anything has been fetched. The
original guarded its Cached branch on row count and its LIVE branch on a flag that
implied rows existed; dropping the flag lost that implication. Restructured so the badge
appears only when there are rows.

### The genuine half

`components/market-sentiment.tsx` carried P7-16's trio verbatim — `lastUpdated`,
`fromCache`, `cacheTimestamp`, written on the cache-load path and read nowhere — so that
tab restored a snapshot of any age and said nothing. Now dated, and marked "Cached
reading from …" when restored. **Fixing one instance of a pattern is not fixing the
pattern:** the CCPI fix landed hours earlier and this copy went unnoticed until
`check-write-only-state.ts` listed it.

Write-only ratchet **14 → 5**. The remaining five are annotated: one redundant rather than
concealing, four not yet individually diagnosed.

| ID | Sev | Tab / area | Finding |
|---|---|---|---|
| P7-26 | P2 | SCAN → nine scanners, ANALYZE → Market Sentiment | **FIXED, and the original finding was half wrong — corrected rather than quietly reworded.** The six "silent" scanners were not concealing anything: `isLive` was removed from `/api/strategy-scanner` by **P1-10**, so the flag was permanently false vestige, and all six already disclose provenance via `<PricingProvenance />`. Rendering it, as the finding proposed, would have re-asserted the exact claim P1-10 deleted. **The real defect was in three OTHER components that do render the flag** — earnings-plays, high-iv-watchlist, wheel-strategy-screener — where the permanently-false branch labelled **every freshly-fetched scan "Cached"**, and none of the three shows `PricingProvenance`. Badges now report cache provenance, which is what the component actually knows. Separately, `market-sentiment.tsx` carried P7-16's trio verbatim and is now dated. Write-only ratchet 14 → 5. |

---

## FOURTH PRODUCTION MERGE — 2026-08-12

**`21be470` → `b9d1e05`, 17 commits, fast-forward.** `main` and `audit-preview` are
identical.

Checks at merge, run individually: typecheck **10 known** · formulas **635** ·
contracts **60 routes / 60 contracts** · remediation **31**.

**Merged on the owner's explicit instruction, without a reported UAT.** That is the
owner's call, and it is recorded here rather than left implicit: nothing in this batch was
confirmed on a rendered page before shipping, and `next build` runs on neither bundler
locally (P7-7), so the Vercel build was the only build gate and it was not observed. www
and staging both answered HTTP 200 immediately after the push — which establishes that the
site is up, not that the changed tabs render correctly.

**The user-visible changes in this batch**, i.e. what to look at first if something is
wrong on production: the CCPI tab (a `.toFixed()` render crash fixed; many cards now
withhold instead of showing `0.25%` / `103.0` / `5.33%`), the Greeks tab (panel hides when
IV is cleared), market-sentiment (now dates its reading), three scanner tabs' badges
(earnings-plays, high-IV, wheel-screener), and the scanner's Step 1-4 labels.

Ships Phase 7 steps **7.1–7.5 complete** — P7-9 (dead exports 51 → 0), the P1 pair
P7-17/P7-18 (22 fabricated constants and twelve `.toFixed()` crash sites; an unavailable
QQQ had been scoring 41 of the momentum pillar as "no risk detected"), P7-20 (an
unscoreable CCPI narrated to the model as "0/100 = markets healthy"), P7-26, S-18, and
**eleven guard scripts** now running in `check:formulas`.

---

## Phase 7.6 (nineteenth pass) — production verification of the fourth merge (2026-08-12)

The fourth merge shipped without a UAT, so this pass verified production directly rather
than trusting the push. **Production is healthy**, and the verification found one thing
nobody was looking for.

### What production actually serves

`www.options-calculators.com` is at `d09d767`. Probed live:

- `/api/ccpi` — HTTP 200 in 1.4s. `pillars: {momentum: 13, riskAppetite: null,
  valuation: null, macro: 24}`, `amplifierInputsUnavailable: ["putCallRatio"]`,
  `certainty: 56`. **Two pillars are null and the composite is renormalised around them**
  — P7-17/P7-18's fix is live and behaving. None of `5.33`, `103.0`, `0.25` or `123`
  appears anywhere in the payload.
- `/api/market-sentiment` — HTTP 200, `lastUpdated` present and current.
- `/api/strategy-scanner?strategy=wheel` — HTTP 200 in 7.0s, 90KB, leading with
  `provenance` and `dataSource`.
- The deployed client bundle contains `"Cached reading from …"` (market-sentiment's new
  dating) and the scanner's Step 1-4 card titles; it does **not** contain `"Step 1 failed"`.
- The Greeks fix (`251b408`) is an ancestor of `origin/main`.

### P7-27 — three of the "three public tabs" are not tabs

**`components/earnings-plays-scanner.tsx`, `components/high-iv-watchlist.tsx` and
`components/wheel-strategy-screener.tsx` are imported by nothing.** They have no case in
`app/page.tsx`'s tab switch, no nav entry, and no referrer anywhere in `app/`,
`components/`, `lib/`, `hooks/` or `scripts/`. A fourth,
`components/wheel-strategy-planner.tsx`, is in the same state. Four files, **1,548 lines**.

The deployed bundle confirms it from the other direction: `page-*.js` on production
carries `"Cached reading from"` — the market-sentiment half of P7-26 — and does **not**
carry `"Fetched this session"`, the badge the same commit added to those three scanners.
The build tree-shook them out because nothing imports them.

So P7-26's commit message is wrong where it says the "Cached" defect was live "on three
public tabs, and none of the three renders PricingProvenance to offset it". The source
change is correct and the reasoning about the badge is correct; the claim about user
impact is not. **That is the second wrong premise in that one finding** — it was first
recorded as six scanners hiding a live flag, corrected to three tabs rendering a false
one, and the corrected version was also wrong about who could see it.

Why nothing caught it: `check-dead-exports.ts` scopes to `walk(lib/)` and treats
`components/` only as a *referrer* set, so an unreachable component is outside every check
in the suite. The provenance rules read a component's labels without asking whether a user
can reach the component, and the PASS count is identical either way. This is the P6-77
shape again — a check that stops covering looks exactly like one that passes — except here
the coverage was never there.

**The owner chose retire over rebuild, so all four are deleted** — 1,548 lines out. The
alternative was wiring them into the tab switch, which would have added four public
surfaces that no phase of this audit has ever reviewed as live: none has been through the
provenance rules with a user in front of it, and P7-26 is the evidence for what that
costs.

What ships alongside the deletion is `scripts/check-dead-components.ts`, a ratchet — now
against two, `theme-provider.tsx` and `ui/progress.tsx`, both scaffolding that renders no
number and makes no claim. Negative-tested in three forms: a new unreferenced file, an
existing live component unwired from `app/page.tsx`, and a basename collision (which would
break the import matching without changing any other PASS line). Each failed as designed.

Deleting the four produced no new dead `lib/` export — `check-dead-exports` still reports
225 exports across 49 files, 0 dead.

| ID | Sev | Area | Finding |
|----|-----|------|---------|
| P7-27 | P2 | components / tooling | Four components totalling 1,548 lines were imported by nothing and absent from the deployed bundle, including three that P7-26 described as public tabs. `check-dead-exports` scopes to `lib/`, so no check could see them. All four deleted; ratchet added at the remaining two. |

---

## Phase 7.7 (twentieth pass) — ticker links point at the advanced chart (2026-08-12)

Owner request: every hyperlink on a ticker should open Yahoo's advanced chart,
`https://finance.yahoo.com/chart/<TICKER>`. Scanning for them found the request was also
a bug report.

### P7-28 — one URL, fifteen copies, three spellings

Fifteen components hand-built the destination, and they had already diverged:

- twelve wrote `https://finance.yahoo.com/quote/${ticker}` raw;
- `smart-money-etfs.tsx` wrote `${etf.ticker.replace(".", "-")}` — Yahoo's spelling for
  class shares, where `BRK.B` 404s and `BRK-B` resolves — and **no other site did**, so
  the same symbol linked correctly from one tab and to a dead page from fourteen others.
  Its own version also used a non-global `replace`, so only the first dot converted;
- `scanner/fundamental-results-table.tsx` wrote a third form, `/quote/${ticker}/chart`.

`lib/ticker-links.ts` now owns it: `yahooChartUrl(ticker)` returns the `/chart/` URL with
every dot converted and the rest percent-encoded (so `^SPX` is path-safe), **or `null`
when there is no ticker** — a bare `/chart/` is a live page showing an unrelated default
symbol, so a blank ticker must not produce a link at all. All fifteen sites call it.

`scripts/check-ticker-links.ts` enforces three things, and the third is the one worth
naming: rule 1 ("no hand-built `finance.yahoo.com` page URL outside the library") is
satisfied *perfectly* by a codebase with every ticker link deleted, so the call sites are
counted against a floor as well. That is the P6-77 shape — a check that stops covering
prints the same PASS line as one that passes.

**What building the check found.** Its first form matched the bare host and failed on
`app/api/yahoo-proxy/route.ts`, where `Referer: "https://finance.yahoo.com/"` and
`Origin: "https://finance.yahoo.com"` are outbound request headers impersonating a
browser — not links, and load-bearing for the proxy. Requiring at least one character of
path separates "a page a user is sent to" from "a host named in a header". The residual
blind spot is stated in the file rather than pretended away: a link assembled from a
bare-host constant plus a symbol appended elsewhere would pass.

Negative-tested in three forms — a hand-built URL reappearing in a component, the library
reverting from `/chart/` to `/quote/`, and a call site being deleted — each failing as
designed.

| ID | Sev | Area | Finding |
|----|-----|------|---------|
| P7-28 | P2 | site-wide UI | Fifteen components hand-built the Yahoo ticker URL in three different spellings; only one normalised `.` to `-`, so class-share tickers linked to a 404 from fourteen tabs. Now one library (`lib/ticker-links.ts`), pointing at the advanced chart per the owner, with a check. |
