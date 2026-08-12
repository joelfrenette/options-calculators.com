# FORMULAS.md — Calculation Inventory & Verification Ledger

> Phase 3 deliverable of [AUDIT_PLAN.md](AUDIT_PLAN.md). Generated 2026-08-07 by four
> parallel verification passes (technical indicators · option math · composites &
> forecasters · fundamentals & screening), each checking implementations against
> published reference definitions with numeric spot checks run in Node against
> known-good or hand-computable vectors.
>
> **Verdicts:** CORRECT · CORRECT (approx., labeled) · DEVIATION (works, differs from
> reference) · WRONG (produces incorrect values) · UNGROUNDED (no real data source
> behind the number) · DUPLICATE-OF (extract in Phase 4). Rows marked **FIXED** were
> corrected in the Phase 3 commit; everything else open is logged in
> [AUDIT_BACKLOG.md](AUDIT_BACKLOG.md) §Phase 3.
>
> Standing references: Wilder, *New Concepts in Technical Trading Systems* (RSI, ATR);
> Appel (MACD); Bollinger (bands); Hull, *Options, Futures and Other Derivatives*
> (Black-Scholes, greeks — `lib/black-scholes.ts` is the verified in-repo reference,
> 22 assertions in `scripts/check-black-scholes.ts`).

---

## 1. Technical indicators

| Formula | File:line | Reference | Verdict | Sev | Evidence | Fix |
|---|---|---|---|---|---|---|
| RSI-14 | components/wheel-scanner.tsx:647 | Wilder: seed SMA-14, then (prev·13+cur)/14 | DEVIATION — one-shot Cutler-style SMA over last 14 changes (S-2) | P2 | StockCharts vector: repo 30.22 vs Wilder 37.79 (Δ7.6); over 341 random-walk windows mean Δ 5.81, max 22.76; oversold(<30) gate disagrees 12.6% of windows, overbought 3.5% | Wilder smoothing in lib/indicators.ts (Phase 4) |
| RSI-14 | app/api/trend-analysis/route.ts:135 | Wilder | DUPLICATE-OF wheel RSI (byte-identical math) | P2 | Same numbers apply | Fix once via extraction |
| RSI flat-series boundary | both copies | all-equal series → conventionally 50 | DEVIATION | P3 | 30×100 flat series returns **100** ("max overbought") | Return 50 when avgGain=avgLoss=0 |
| MACD(12,26,9) | components/wheel-scanner.tsx:696 | signal = EMA-9 of MACD series | **CORRECT** (S-1 fix re-verified independently) | ok | vs textbook on 250-bar walk: ΔMACD 0.0000, Δsignal 0.0000; crossover state agrees 341/341; guard <34 bars → zeros ✓ | O(n²) recompute is perf debt only |
| MACD(12,26,9) | app/api/trend-analysis/route.ts:155 | same | CORRECT, but guard is `<26` | P2 | At 26–33 bars the signal EMA falls back to the last value → signal≡macd, histogram≡0 (verified at 30 bars) | Raise guard to 34 |
| EMA | components/wheel-scanner.tsx:714 | k=2/(N+1); standard seed = SMA of first N | DEVIATION (seeds with first price) — immaterial | ok | Δ 8.5e-10 at 250 bars; worst case 0.03% in a 26-bar window | Standardize on extraction |
| EMA | app/api/trend-analysis/route.ts:176 | same | CORRECT (SMA seed) | ok | Matches reference recursion exactly | — |
| Bollinger(20,2) | wheel-scanner.tsx:667 · trend-analysis:111 · lib/qqq-technicals.ts:92 | middle=SMA20, ±2σ population | CORRECT ×3 (two DUPLICATEs) | ok | Repo upper 103.7643 = population-σ reference; Bollinger's published definition uses population σ | Consolidate; trend copy collapses all 3 bands to last price on short series — return null instead |
| Stochastic %K(14) | wheel-scanner.tsx:726 | 100·(C−L14)/(H14−L14) | CORRECT (raw %K, no %D) | ok | Hand vector → 60.0 exact; flat window → 50 | Note "raw %K" in UI |
| ATR-14 true range | wheel-scanner.tsx:742 | TR = max(H−L, \|H−Cₚ\|, \|L−Cₚ\|) | CORRECT | ok | Gap-day check → TR 5.00 ✓ | — |
| ATR-14 smoothing | wheel-scanner.tsx:755 · trend-analysis:189 | Wilder (prev·13+TR)/14 | DEVIATION — simple mean of last 14 TRs | P3 | vs Wilder: mean Δ 1.1%, max 4.0% over 341 windows | Wilder smoothing on extraction |
| SMA short-series boundary | wheel-scanner.tsx:641 | — | **WRONG boundary** | P2 | <N bars → returns 0, so for IPOs sma200=0 and `uptrend = sma50 > sma200` (:1225) is **always true** → false Golden Cross passes the filter (demonstrated on 60-bar series) | Return null; fail/flag the check when SMA unavailable |
| "200-day MA" | app/api/trend-analysis/route.ts:105 + :69 | 200-day SMA | **WRONG — was unreachable · FIXED** | P0 | Fetched 180 calendar days ≈124 bars < 200 → fallback returned the **last close** as the "200-day MA" on every request; the 3-point MA-alignment signal in determineTrend compared price to itself | Fetch window raised to 320 days (~220 bars), matching qqq-technicals' 300 |
| Golden/death-cross state | wheel-scanner.tsx:1225, 3841 | 50>200 level check | CORRECT as state; tooltip says "has crossed" (event) | P3 | Poisoned only by the SMA-0 boundary above | Fix boundary; soften wording |
| SMA 20/50/200 (QQQ) | lib/qqq-technicals.ts:71-84 | SMA | CORRECT | ok | Explicit hasSMA guards; 300-day fetch ≥200 bars ✓ | — |
| SMA-proximity "danger" | lib/qqq-technicals.ts:109-147 | custom heuristic | CORRECT direction | ok | Piecewise linear, monotone ✓ | Label as heuristic in UI |
| consecutiveDaysDown | lib/qqq-technicals.ts:54-62 | "consecutive down days" | DEVIATION — only counts < −1% days | P3 | −0.5% day breaks the streak | Rename or use <0 |
| Momentum-strength composite | trend-analysis:234 | custom (RSI±20, MACD±15, ROC±10, vol±5) | CORRECT direction; 2 defects | P3 | `macd*3` in raw price points → pinned at ±15 for SPX-priced series (dead weight); <20 bars → NaN unguarded | Normalize by price; guard length |
| determineTrend 9-pt vote | trend-analysis:268 | custom | DEVIATION via poisoned ma200 (now fixed) + redundant MACD clause | P2→P3 | `macd>signal && histogram>0` is the same condition twice | Drop redundant clause |
| Support/resistance | trend-analysis:205 | 5-bar fractal swing points | CORRECT | ok | 11-bar centered extrema, ±5% fallback — sane | — |
| SMA (4th copy) | app/api/market-sentiment/route.ts:44 | SMA | CORRECT / DUPLICATE | ok | ~126 bars for a 125-day MA — one bad bar from silently averaging the whole array | Fetch 1y for margin |
| "125-day / 50-day MA" on weekly bars | app/api/panic-euphoria/route.ts:14 (interval=1wk) | day-denominated MAs | **WRONG period units** | P2 | Fetch hardwires weekly bars → "125-day MA" is a 125-**week** (~2.4 yr) MA; "50-day" is 50-week; both feed the momentum/margin-debt/put-call proxies | Fetch daily, or relabel |
| CCPI ATR indicator | app/api/ccpi/route.ts (fetchAlphaVantage) | ATR from market data | **WRONG — hardcoded 35** on every path | P1 | Never computed or fetched; scoring branch `>30 → 1` always contributes; dashboard prints "ATR at 35.0" as if live. Now an explicit named baseline (volatility fix below); real sourcing still open | Compute from Polygon aggregates or drop indicator |
| Other 6 scanners | components/*-scanner.tsx | — | N/A — no local indicator math | ok | grep: zero hits | — |
| qqqDeathCross panel | components/ccpi-dashboard.tsx:1324-1368 | SMA50<SMA200 | WRONG — dead UI, no producer sets the field | P3 | Repo-wide grep: only the dashboard references it → panel never renders | Wire from qqq-technicals or delete |

## 2. Option math

| Formula | File:line | Reference | Verdict | Sev | Evidence | Fix |
|---|---|---|---|---|---|---|
| normalCDF | components/greeks-calculator.tsx:14-19 | A&S 26.2.17 | CORRECT | ok | Hull vector → call 4.7594 / put 0.8086 (book 4.76/0.81) | — |
| Delta / Gamma / Theta / Vega / Rho | greeks-calculator.tsx:43-59 | Hull closed forms | CORRECT ×5 | ok | Each within finite-difference tolerance (e.g. Δ 0.5343 vs FD 0.5327; Θ −0.06312 vs −0.06316/day) | — |
| Hardcoded r=4.5% not shown | greeks-calculator.tsx:203 | — | DEVIATION | P3 | User cannot see the rate their rho assumes | Show or make editable |
| "Delta ≈ P(ITM)" | greeks-calculator.tsx:329 | true P(ITM)=N(±d2) | DEVIATION (standard shorthand, hedged with "~") | P3 | \|Δ\|=N(−d1)≠N(−d2) for puts | Optional footnote |
| ROI / annualized ROI / risk-reward | risk-reward-calculator.tsx:23-25 | simple annualization, stated in tooltip | CORRECT | ok | 500/10000=5%; tooltip states ×365/d formula explicitly | — |
| Expected move = ATM straddle | earnings-volatility-calculator.tsx:37-43 | market convention | CORRECT (labeled) | ok | ±(C+P)/S; breakevens consistent with the stated ATM assumption | Optionally note the 0.85× desk variant |
| IV crush risk | earnings-volatility-calculator.tsx:33 | (IV−HV)/HV | CORRECT | ok | 45 vs 30 → 50% ✓ | — |
| Strangle breakevens | earnings-volatility-calculator.tsx:46-48 | OTM option prices | DEVIATION | P3 | Reuses ATM-labeled prices with user OTM strikes → overstated cost | Relabel inputs or add price fields |
| Payoff: bull put · condor · butterfly · collar · straddle · wheel CSP | options-strategy-toolbox.tsx:519-631 | piecewise-linear payoff geometry | CORRECT ×6 | ok | Kinks, plateaus and breakevens verified numerically per strategy (e.g. condor 100→+200, 93→0, 85→−300) | — |
| Payoff: calendar · diagonal | options-strategy-toolbox.tsx:553-612 | BS residual value at near expiry | CORRECT (approx.) — Gaussian time-value bump, not BS | P3 | Geometry right; header claims "canonical Black-Scholes" — overstated | Price the long leg via lib `calculateOptionPrice`, or soften comment |
| Payoff sampling | options-strategy-toolbox.tsx:507-511 | kinks on samples | DEVIATION (cosmetic) | P3 | Strike can fall between 100 samples; monotone spline rounds corners | Add strikes to sample set |
| Collar stats text | options-strategy-toolbox.tsx:263-264 | max profit = K_call − S₀ − net debit | **WRONG sign** in prose | P3 | Adds put premium (a cost) to max profit; inconsistent with its own maxLoss line | "− Net Premium Paid" |
| Learn pages: CSP · CC · LEAPS · PMCC diagrams | learn-{csp,cc,leaps,pmcc}.tsx | per-contract payoffs | CORRECT ×4 | ok | BEs, caps, floors and example arithmetic verified (CSP BE 48, CC cap +650, LEAPS +3200/178%) | Fix stale "per-share" comment in learn-csp |
| PMCC worked example | components/learn-pmcc.tsx:97-98 | its own payoff model | **WRONG** | P2 | S=110 case double-counts the short-call credit: claims ≈$400, correct $200 (the page's own "8.7% on $2,300" = $200 contradicts it); crash case $1,100 should be $1,300 | Correct both figures |
| Walkthrough: iron-condor legs | components/trade-walkthrough-modal.tsx:149-194 | 4-leg condor | **WRONG** | P2 | "550/545 – 580/585" parses as a 2-leg CALL vertical (wrong side, wrong right, 2 legs missing) in the chain/ticket mockups | Special-case 4-number setups or pass structured legs |
| Walkthrough BP effect | trade-walkthrough-modal.tsx:739 | width×100 | CORRECT (approx.) | P3 | Integer widths fine; 2.5 renders "$2.500" | toLocaleString |
| Earnings expectedMove | components/wheel-scanner.tsx:773 | 1σ = S·σ_d·√d | DEVIATION (S-10 confirmed) | P2 | Heuristic ≈0.79× the 1σ reference at all horizons; √(d/7) is an arbitrary rebase | Use lib `expectedMove()` with measured IV |
| Step-3 estimated premium | wheel-scanner.tsx:1198-1211 | ATM put ≈ 0.4·S·σ√T | CORRECT (approx., labeled) | P3 | Ballpark for ~5% OTM weeklies; vol double-count + clamp noted; tooltip does say "estimated" | Fold into S-9 rework |
| Market-closed estimated delta | wheel-scanner.tsx:1492-1498 | BS put delta | **WRONG** (S-9 confirmed, worse than logged) | P2 | 7 DTE 35% IV: K=95 est −0.429 vs BS −0.136; K=90 est −0.365 vs BS −0.013 — ignores time and IV entirely; the code comment's own example doesn't match its formula | `calculatePutDelta` with estimated IV |
| Market-closed estimated premium | wheel-scanner.tsx:1502-1508 | BS put price | **WRONG** (S-9) | P2 | K=90 7DTE: est $1.57 vs BS $0.02 — **~80× overstated** for OTM weeklies | `calculateOptionPrice` with estimated IV |
| Premium yield · annualized yield · DTE · IV units | wheel-scanner.tsx:1518-1564 | standard | CORRECT ×4 | ok/P3 | Yield on strike collateral ✓; annualized is simple ×365/DTE — column header never says so (label debt); Polygon IV decimal→% ✓ | Tooltip: "simple annualization" |
| Planner: required premium % | components/wheel-strategy-planner.tsx:57 | (prem$/100)/price | **WRONG — 100×** | P2 | $200/wk on $150 stock shows "22.22% of stock price"; correct 0.22% (per-contract dollars ÷ per-share price) | Divide by 100 |
| Planner: maxContracts / assignment zone | wheel-strategy-planner.tsx:55-77 | floor(capital/(strike·100)); assignment ≤ strike | DEVIATION ×2 | P3 | maxContracts 0 → renders $Infinity; "assignment zone" upper bound 5% *above* strike | Guard 0; strike as upper bound |
| Strategy-scanner route wiring | app/api/strategy-scanner/route.ts | lib/black-scholes | CORRECT | ok | IV decimal ✓, dte/365 ✓, put/call flags ✓, condor POP conservatively uses short strikes (butterflies correctly use breakevens) | — |

## 3. Composite indexes & forecaster models

| Composite | File:line | What it computes | Verdict | Sev | Evidence | Fix |
|---|---|---|---|---|---|---|
| CCPI pillar weights | lib/ccpi/constants.ts:12-17 | 0.35/0.30/0.15/0.20 weighted avg | SOUND | ok | Sum 1.00; route re-hardcodes same values; stale comments still say 40/30/20/10 | Import constants; fix comments |
| CCPI Pillar 1 bounds | app/api/ccpi/route.ts:710-860 | 13 indicators summed | **WRONG scale** | P1 | Branch maxima sum to **90**/100 (verified numerically) → pillar can never reach its stated scale; max attainable base CCPI ≈ 92 | Rescale to 100 |
| CCPI Pillar 2 bounds | route.ts:862-967 | 8 indicators summed | **WRONG scale** | P1 | Maxima sum to **85**/100; canary #18 claims an ETF-flows weight that isn't in the pillar at all | Rescale; reconcile canary claims |
| CCPI Pillars 3 & 4 | route.ts:969-1147 | 7+7 indicators | SOUND | ok | Both max exactly 100 | — |
| CCPI volatility inputs | route.ts:384-390 + fetchAlphaVantage | VIX/VXN/RVX/ATR/LTV | **WRONG — was frozen · FIXED (VIX)** | **P0** | `fetchAlphaVantageIndicators` returned hardcoded `vix:18…` on success AND failure → the AI-fetched VIX was dead; VIX score permanently 2 pts, VIX>35 crash amplifier and VIX canaries could never fire. **Fixed:** real FRED spot VIX (VIXCLS, already fetched by `fetchVIXTermStructure`) now feeds first, AI fallback second; VXN/RVX/ATR/LTV/spotVol are now explicit named baselines (sourcing still open, P1) | Source VXN/RVX quotes + real ATR |
| CCPI dead indicators | route.ts:429, :393 | nvidiaMomentum, bullishPercent | WRONG · **nvidiaMomentum FIXED** | P2 | `fredData?.nvidiaMomentum` never exists → was always 50; the Alpha-Vantage-computed momentum was discarded (now wired). `bullishPercent: 58` still hardcoded → its score is constant | Source or remove bullishPercent |
| CCPI yield-curve triple count | route.ts:844, :952, :1187 | scored in P1 (10) + P2 (8) + amplifier (+15) | DEVIATION | P1 | One indicator worth ≈20 CCPI points; duplication acknowledged in a canary comment | Score once, or document |
| CCPI crash amplifiers | route.ts:1149-1198 | additive bonuses | WRONG ordering | P2 | `if (ret <= -6) +25; else if (ret <= -9) +40` — the −9% branch is unreachable (−10% returns 25) | Reverse branch order |
| CCPI "certainty" | route.ts:1201-1215 | 70%·(100−3σ_pillars) + 30%·(canaries/15) | UNGROUNDED | P1 | **More warning canaries ⇒ higher certainty** (0→70, 15→100, verified); ignores live-vs-baseline source count | Derive from apiStatus live fraction |
| CCPI Fear & Greed input | route.ts:692-708 | api.alternative.me/fng | **WRONG index** | P1 | That is the **crypto** Fear & Greed index, silently scored as equity sentiment (weight 15 in Pillar 2) | Use the CNN scrape already in the repo |
| CCPI playbook | route.ts:1231-1242 | static object | WRONG | P1 | `getPlaybook(regime)` ignores `regime` — "Risk-On, 60-80% equities" even in Crash Watch | Branch on regime |
| CCPI cache POST | route.ts:201 | — | **WRONG · FIXED** | P1 | `JSON.JSON.stringify` — TypeError swallowed by catch; cache never populated via this path | Fixed to `JSON.stringify` |
| CCPI baseline dilution (S-12 answer) | route.ts:370-437 | — | **CONFIRMED WRONG** | P1 | Baselined values are averaged in at **full weight**, no per-field flag, nothing consults apiStatus; the one null-aware input (F&G) is excluded but **not renormalized**, deflating Pillar 2 by up to 15 pts. Baseline constants encode calm-2024 values → structural bias | Exclude + renormalize over live weight |
| AI-fallback market data | lib/unified-ai-fallback.ts:61-116 | LLM-recalled CAPE/Buffett/P-C/PMI… | UNGROUNDED | P1 | Values "fetched" by asking LLMs, accepted if `> 0`, fed to scoring identically to live data; the `> 0` filter also rejects legitimately negative series | Real APIs; surface AI-sourced flag in scoring |
| Social sentiment composite | app/api/social-sentiment/route.ts:323-347 | reliability-weighted mean, renormalized | SOUND | ok | Missing sources excluded AND weights renormalized — the good pattern. Nits: sub-scores unweighted; all-dead → silent 50 | Weight sub-groups; null over 50 |
| Panic/Euphoria construction | app/api/panic-euphoria/route.ts:121-295 | mean of 9 components | UNGROUNDED | P1 | 7 of 9 "components" are algebraic transforms of VIX and SPX momentum — a VIX proxy averaged 9 ways, presented as a Citi replication; `latestCitiReading: 0.72` hardcoded with a fixed date | Label as proxy; remove fake Citi reading |
| Panic/Euphoria MMF input | route.ts:194-204 | FRED WRMFSL vs 5-7 $T band | **WRONG series** | P1 | WRMFSL is retail-only (~$2T) vs a total-MMF band → clamps to **+1 max-euphoria whenever the key works** | Use total-MMF series or recalibrate |
| Panic/Euphoria thresholds | route.ts:249-255 vs UI | −0.17 / +0.41 | SOUND | ok | Match Citi convention and page tooltip; component's extra ±extreme bands invented but cosmetic | Align level names |
| FOMC forecaster | app/api/fomc-predictions/route.ts:230-503 | heuristic rule ladder | UNGROUNDED | P1 | **No Fed Funds futures anywhere**, yet the payload's `predictionMethodology` claims "CME FedWatch methodology, analyzing Fed Funds futures" with weights that appear nowhere in code; confidence formulas invented | Real futures data or delete the false claims |
| FOMC 2Y Treasury | route.ts:220-224 | ^FVX as "2-year" | **WRONG symbol** | P1 | ^FVX is the CBOE **5-Year** index → the "2Y-10Y" spread and inversion signal are actually 5Y-10Y | FRED DGS2 |
| FOMC misc | route.ts:27-155, :309 | — | DEVIATION | P2 | Dead predictionScore; prior-YoY spans 11 months (needs 14 obs); decay factor goes negative at meeting 8+ (flips cuts to hikes, latent); meeting list ends Mar-2027 → crash after | Fetch 14 obs; clamp; extend calendar |
| CPI forecaster | app/api/cpi-inflation/route.ts:9-93 | YoY + mean-reversion heuristic | DEVIATION | P2 | YoY arithmetic correct; forecast constants 0.15/0.7 unsourced; clamp floor 1.5% forbids sub-1.5% forecasts; `yoyChange` field mislabeled | Label heuristic; fix field name |
| Jobs forecaster | app/api/jobs-report/route.ts:128-194 | linear slope extrapolation | DEVIATION | P2 | FRED math correct (best-grounded of the three); confidence/bands invented; pct-point diff formatted with % sign | Document heuristics |
| Market sentiment fallback | app/api/market-sentiment/route.ts:227-483 | mean of 7 sub-scores | DEVIATION | P1 | VIX double-counted (fake "Put/Call" = VIX ratio + absolute VIX); `calculateMarketVolatility` **ignores its vix50DayMA parameter**; highs/lows from momentum with invented anchors | Real CBOE P/C; honor the parameter |
| Market sentiment historical deltas | route.ts:389-396, :613-618, :866-904 | week/month/year changes | **WRONG — fabricated** | P1 | Scrape path: all periods = today → changes always 0. Other paths: `lastMonthChange = score − weekAgo×1.2`, `lastYearChange = score − weekAgo×2` — pure fabrication; plus a `100 − x?.score \|\| 50` precedence bug and invented `cboeSkewIndex = 100+(VIX−15)×2` | Store real history; delete the ×1.2/×2 lines |
| VIX term structure | lib/vix-term-structure.ts:40-49 | backwardation detection | **WRONG — cannot trigger** | P1 | "1M future" = spot × 1.08 → termStructure = 0.08·spot is always positive → `isInverted` mathematically always false; the module's stated purpose (crash signal) is unreachable, and CCPI's 6-pt indicator instead fires its "flattening" branch when VIX < 15 — flagging **calm** markets as risk | Real VX futures or VIX3M/VIX ratio; pick one convention (difference vs ratio) |

## 4. Fundamentals & screening

| Calculation | File:line | Intended | Verdict | Sev | Evidence | Fix |
|---|---|---|---|---|---|---|
| ROE TTM numerator | components/wheel-scanner.tsx:1047-1051 | sum of 4 quarterly NI | DEVIATION | P2 | 2 filed quarters → half-year NI treated as TTM (ROE 10% vs true ~20%) | Require 4 quarters or annualize; else "insufficient history" |
| ROE denominator | wheel-scanner.tsx:1052 | avg equity | DEVIATION | P3 | Single latest-quarter equity (common simplification) | Optional averaging |
| ROE null→zero (S-15 confirmed) | wheel-scanner.tsx:1101 | missing ⇒ n/a | **WRONG** | P2 | Missing OR NEGATIVE equity → ROE 0% → rejected at :1140, rendered "0.0%" at :3077; profitable buyback names with negative equity read as junk | null + "insufficient history"; skip the gate on null |
| Debt-to-Equity | wheel-scanner.tsx:1098 | total debt ÷ equity | DEVIATION | P2 | Uses **total liabilities** (systematically higher); negative equity → D/E 0 which **passes** the max-D/E filter — the most-leveraged names sail through the debt gate | Real debt fields or relabel; null on negative equity |
| P/E · TTM EPS | wheel-scanner.tsx:1064-1095 | standard | CORRECT | ok | price/eps ≡ mcap/NI verified; partial-TTM caveat shared with ROE | 4-quarter guard fixes both |
| Fabricated quarterly EPS | wheel-scanner.tsx:1221 | real per-quarter EPS | WRONG | P2 | <4 quarters → renders an invented even 4-way split as "last 4 EPS" | Show real partial array, label gaps |
| Profitable-quarters count | wheel-scanner.tsx:1039-1044 | consecutive from latest | CORRECT | ok | Missing counts as not-profitable (conservative) | — |
| Profitable-quarters clamp | wheel-scanner.tsx:1148 | require slider N | DEVIATION | P2 | 1 filed quarter + slider=8 → requirement silently lowered to 1 and **passes** (inverse of S-15: too lenient) | "Insufficient history" instead of lowering the bar |
| Market cap | wheel-scanner.tsx:1074-1086 | price × shares | DEVIATION | P3 | Resolves to `basic_average_shares` (period average, not current float); fallback algebra verified | Fetch reference shares or comment truthfully |
| Market-cap tier & volume units | wheel-scanner.tsx:480-493, :1730 ↔ polygon-tickers | raw dollars / raw shares end-to-end | CORRECT | ok | 12-stop table; all three API paths take raw units (the "slider index 1-5" premise in older docs is outdated) | — |
| rangePct | app/api/polygon-tickers/route.ts:171 | (H−L)/C | CORRECT | ok | 105/95/100 → 10% ✓ | — |
| Fallback path ignores minRangePct | polygon-tickers/route.ts:631-635 | — | DEVIATION | P3 | Hardcoded-universe fallback silently ignores an active volatility slider | Add a note field |
| fmp-valuation | lib/fmp-valuation.ts:23-28 | pass-through ratios | CORRECT | ok | Bad values → `undefined`, never 0 — **the pattern to replicate** | — |
| Landmine FOMC rule (S-3 confirmed) | lib/economic-events.ts:76-90 | 8 meetings/yr | **WRONG** | P2 | 2026 sweep: emits only 2 of 8 meetings, and those 2 dates are the *2024/25* dates; 6 real 2026 meetings invisible | Published Fed calendar or Finnhub |
| Landmine CPI dedupe | economic-events.ts:60-73 | one CPI per month | WRONG | P2 | Whole-array `some()` → a window spanning two months emits only the first month's CPI | Dedupe per YYYY-MM |
| NFP first-Friday · claims dates | economic-events.ts:25,38 | first Friday | CORRECT | ok | `day===5 && date<=7` exact | — |
| Calendar TZ mixing | economic-events.ts:20-22 | consistent dates | DEVIATION | P3 | Local getDay + UTC toISOString — consistent only under TZ=UTC (true on Vercel) | getUTC* throughout |
| Landmine window clamp | app/api/landmine-check/route.ts:35-44 | [today, +45d] | DEVIATION | P3 | UTC `from` rolls past 8 PM ET → tonight's AMC earnings fall out of the query | Compute in America/New_York |
| daysToEarnings | wheel-scanner.tsx:1116 | calendar days | DEVIATION | P3 | Floor + TZ → "tomorrow" can show 0d | Date-granularity diff |
| Insider cluster value | app/api/insider-clusters/route.ts:96 | shares transacted × price | **WRONG · FIXED** | **P0** | Finnhub `share` = post-trade HOLDINGS, `change` = shares transacted; valuing `share × price` priced the insider's whole position as the buy (~500× overstated for large holders). Fixed to `change × price`; rows without a usable `change` skipped | Confirm against one live payload on preview |
| Insider-trading share count | app/api/insider-trading/route.ts:404-416 | transacted quantity | **WRONG · FIXED** | **P0** | Same defect: code preferred `t.share` while its own comment said "prefer the signed change"; holdings also biased the direction fallback to "Buy" | Same live-payload confirmation |
| Cluster detection | insider-clusters/route.ts:89-91 | ≥2 distinct insiders, code P | CORRECT | ok | Distinct-by-name, open-market only | — |
| Congress amount parsing | app/api/congress-trades/route.ts:14-31 | STOCK Act bucket midpoint | CORRECT | ok | "$1,001 - $15,000"→8001 ✓; "$50,000,000+"→50M ✓ | Amount fallback labels a low-end as midpoint (P3) |
| Top-performers range parse | app/api/top-performers/route.ts:38-47 | same | DEVIATION | P3 | No single-value fallback → "$50,000,000+" → $0 → the **largest** trades drop out of dollar-weighted XR | Copy the fallback from congress-trades |
| Top-performers return math | top-performers/route.ts:182-185 | avg + $-weighted XR | CORRECT | ok | Arithmetic verified | — |
| Session move % | lib/trend-filters.ts:sessionMovePercent | (last−prior)/prior×100 | CORRECT | ok | Signed, so a −12% day is never read as a +12% day; non-positive prior → null rather than Infinity. 6 assertions | — |
| Move in ATR units | lib/trend-filters.ts:moveInAtrUnits | \|move\| ÷ ATR(14) | CORRECT | ok | Display-only context for the fixed % gate: 10% on a $10 stock is 4 ATRs at ATR 0.25, 1 ATR at ATR 1.00. 4 assertions | — |
| Trailing 12-month return | lib/trend-filters.ts:trailingReturnPercent | close vs close 252 sessions back | CORRECT | ok | Baseline is the bar 252 back, never "first available" — one bar short returns null, not a 251-session change under a 12-month label. 5 assertions | — |
| 12-1 momentum | lib/trend-filters.ts:momentum12m1 | t−12mo → t−1mo | CORRECT | ok | Jegadeesh–Titman skip-a-month; asserted to differ from the plain 12-month return (231 vs 252 on a 1/session ramp). 2 assertions | — |
| Weinstein Stage 4 | lib/trend-filters.ts:isStage4Decline | price < SMA150 **and** SMA150 falling | CORRECT | ok | The slope is the load-bearing half: price below a *rising* 150 is a pullback and returns false. SMA150 comes from lib/indicators.ts at the call site, never recomputed. 5 assertions | — |
| Relative return vs SPY | lib/trend-filters.ts:relativeReturnPoints | stock% − benchmark% | CORRECT | ok | −5% against a market at −20% is **+15 points of outperformance**; null benchmark declines rather than comparing against 0. 4 assertions | — |
| CSP entry exclusions | components/scanner/technical-criteria.ts:cspEntryGates | hard filter, not a criterion | CORRECT | ok | Applied before options enrichment so an excluded stock reaches neither the strict nor the relaxed table; every gate fails safe on null. With a positive benchmark year the laggard gate is strictly STRONGER than the down-year gate — asserted, after the first draft of that comment claimed the reverse | — |

## 5. Systemic patterns (cross-cutting)

1. **`|| 0` / `|| constant` as data laundering** — the single biggest source of wrong
   data site-wide: missing values become confident zeros (fundamentals), frozen
   constants become "live" inputs (CCPI volatility), and parse failures become $0
   trades. `lib/fmp-valuation.ts` (null through, never 0) is the house pattern to
   standardize on. The Phase 1 strategy-scanner rebuild and Phase 3 fixes apply it;
   the rest is Phase 4/7 work.
2. **Proxies presented as the real series** — crypto F&G as equity sentiment, VIX
   transforms as nine "independent" Panic/Euphoria components, beta restated as
   "price stability", ^FVX as a 2-year yield, LLM recall as market data. Each needs
   the real series or an explicit proxy label.
3. **Four copies of the indicator suite** (wheel-scanner, trend-analysis,
   qqq-technicals, market-sentiment) with three RSI/ATR variants between them —
   the Phase 4 `lib/indicators.ts` extraction is what makes every fix above stick.

## 6. Not verified (out of reach this session)

- Live Polygon/Finnhub/FRED behavior: no keys locally + workstation TLS interception;
  every "confirm against a live payload" note needs the preview-deploy pass.
- `lib/sentiment-sources.ts` scrape internals; Quiver `ExcessReturn` units;
  Polygon snapshot `shares_outstanding` availability; FMP screener path (403-dormant).
- Toolbox static example setups (labeled "For Learning" — no snapshot to check against).
