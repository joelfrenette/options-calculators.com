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
| S-7 | P3 | SCAN → Sell Put Scanner; polygon-tickers | [components/wheel-scanner.tsx:181](components/wheel-scanner.tsx:181), [:329](components/wheel-scanner.tsx:329), [app/api/polygon-tickers/route.ts:217](app/api/polygon-tickers/route.ts:217) | Three hardcoded ticker universes: `MEGA_CAP_STOCKS`, `MEGA_CAP_STOCKS_ALPHABETIZED`, and the `MAJOR_INDEX_TICKERS` fallback. | Confirm which are still reachable; delete the dead ones, and label the `MAJOR_INDEX_TICKERS` fallback in the UI when it is the source actually used. |
| S-8 | P2 | SCAN → Sell Put Scanner (Steps 3–4) | [components/wheel-scanner.tsx:599-600](components/wheel-scanner.tsx:599), [:1782-1784](components/wheel-scanner.tsx:1782), [:2037-2038](components/wheel-scanner.tsx:2037) | Hidden gates with no UI control: `minYield` defaults to 1 (%) and `minVolumeTechnicals` to 2 (M), and both filter results at `yieldCheck`/`volumeCheck`. `minVolume` (2M) at [:511](components/wheel-scanner.tsx:511) does have UI. `maxPE` at [:519](components/wheel-scanner.tsx:519) is declared and never read — dead state. | Expose `minYield`/`minVolumeTechnicals` as sliders or document them in the Step 3 explainer; delete `maxPE`. |
| S-9 | P2 | SCAN → Sell Put Scanner (Step 4, market closed) | [components/wheel-scanner.tsx:1479](components/wheel-scanner.tsx:1479), [:1484](components/wheel-scanner.tsx:1484) | `delta = -0.5 * moneyness³` and `estimatedIV = 0.35` are invented constants used when live greeks are unavailable. Whether the user can tell these rows are estimates needs verification. | Verify the `useEstimatedGreeks` badge actually renders on every affected cell; if not, add it. Cite the constants' provenance in the tooltip or replace with IV-derived values. |
| S-10 | P2 | SCAN → Sell Put Scanner (Landmine expected move) | [components/wheel-scanner.tsx:754](components/wheel-scanner.tsx:754) | `expectedMove = price × (ATR% / 100) × √(days/7) × 1.5`. The `1.5` is a fudge factor with no reference. Real IV is now captured. | Replace with the standard IV-based expected move `price × IV × √(DTE/365)`; unit-test in Phase 3. |
| S-11 | P3 | ANALYZE → Social Sentiment | [app/api/social-sentiment/route.ts](app/api/social-sentiment/route.ts) (`www.aaii.com`) | AAII sentiment fetch is unreliable; component runs on a baseline. Needs a Nasdaq Data Link free key to be real. | Either wire the key or delete the AAII pillar — a permanently-baseline pillar in a composite silently biases the composite. |
| S-12 | P3 | ANALYZE → CCPI | [lib/market-breadth.ts](lib/market-breadth.ts), [app/api/market-breadth/route.ts](app/api/market-breadth/route.ts) | NYSE breadth and ETF-flow pillars run on graceful baselines by design. | Revisit in Phase 3 when CCPI pillar weights are verified — confirm a baselined pillar is excluded from, not averaged into, the composite. |
| S-13 | P3 | ops | Vercel env | `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` unused since Reddit was removed. | Delete from Vercel env (manual — requires dashboard access). |
| S-14 | P3 | SCAN → polygon-tickers | [app/api/polygon-tickers/route.ts](app/api/polygon-tickers/route.ts) | FMP screener 403 path is dormant. | Gate on plan detection or document that the path is unreachable on the current FMP plan. |
| S-15 | P2 | SCAN → Sell Put Scanner (Step 2 fundamentals) | [components/wheel-scanner.tsx](components/wheel-scanner.tsx) | Newly-IPO'd tickers with thin financial history (e.g. SPCX) render `0%` ROE rather than "insufficient history" — a real zero and a missing value are displayed identically. | Distinguish `null` from `0` through the fundamentals pipeline; render "insufficient history". |
| S-16 | P3 | SCAN → Sell Put Scanner | [components/wheel-scanner.tsx:77](components/wheel-scanner.tsx:77) (`CACHE_VERSION`) | localStorage keys from older cache versions are never evicted; they accumulate in the user's browser forever. See SITE_MAP.md §7 for the full key inventory. | On mount, sweep and drop keys matching the family prefix whose version segment ≠ current. |
| S-17 | P3 | SCAN → Sell Put Scanner | [components/wheel-scanner.tsx](components/wheel-scanner.tsx) | Earnings-date extraction from the Polygon snapshot is redundant now that the Landmine/Finnhub path supplies it. | Delete the redundant extraction. |
| S-18 | P2 | SCAN → Sell Put Scanner (copy) | [components/wheel-scanner.tsx](components/wheel-scanner.tsx) | Step numbering drift — buttons, card headings and error strings disagree about which step is which. | One source of truth for step numbers/labels; render everything from it. |
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

_Pending._

---

## Phase 2 findings (API contracts & health)

_Pending._

---

## Closed

_None yet._
