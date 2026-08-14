# CCPI Redesign — a leading indicator, not a dashboard

**Status:** APPROVED 2026-08-10 — all five decisions in §8 are taken. Phase 1 may begin.
**Written:** 2026-08-10. Supersedes AUDIT_BACKLOG P6-35 (which proposed re-weighting the
existing indicator set — the wrong question, answered well).

---

## 1. The goal, and the honest ceiling

Joel's stated requirement: *"an indicator that can predict a crash or correction BEFORE it
occurs, so I can close out my positions and move to cash."*

That is a legitimate and achievable goal **if it is stated precisely**. It is not achievable
as "Nostradamus". No public data set predicts market crashes reliably, on a known date, with
few false alarms. Crashes are partly endogenous — the selling causes the selling — and the
part that is endogenous is not visible in advance in any series anyone can buy.

What *is* achievable, and what this design targets:

> **A risk gauge that goes to an elevated state some weeks-to-months before the majority of
> historical drawdowns began, with a measured hit rate and a measured false-positive rate,
> both stated on screen.**

The false-positive rate is the part that matters and the part that dashboards always omit.
A signal that fired before all four of 2000, 2008, 2020 and 2022 is worthless if it also
fired eleven other times. **Every indicator in the redesigned score must report both numbers,
measured on this site's own data, or it does not score.** That is the existing E-6 rule; this
document is mostly about finally being able to enforce it.

### What "useful" looks like in practice

A concrete, testable target — the thing to hold the design to:

- **Lead time:** median 20+ trading days between first elevated reading and the drawdown start.
- **Hit rate:** fires before ≥ 3 of the 4 reference drawdowns (2000-03, 2007-09, 2020-02, 2022-01).
- **False positives:** ≤ 1 per 2 years of history that is not followed by a ≥ 10% drawdown
  within 6 months.
- **Persistence:** the elevated state lasts long enough to act on (not a one-day spike).

An indicator that cannot be measured against those four numbers is a *display* indicator.
It can appear on the page. It cannot move the score.

---

## 2. Why the CCPI as built cannot do this

Not a criticism of the work — it was built as a *conditions dashboard*, and it is a good one.
It is being asked to do a different job. Assessed against the prediction goal:

| Pillar | Weight | Verdict |
|---|---|---|
| Momentum & Technical | 35% | **Coincident by construction.** "QQQ below its 200-day SMA", "3 consecutive down days", "VIX above 35" — every one of these is true *because* a decline is already underway. They are a stop-loss rule wearing the clothes of a forecast. Lead time is structurally zero or negative. |
| Valuation & Market Structure | 15% | **No timing content whatsoever.** CAPE was "extreme" continuously from 1996 to 2000, and again from 2017 to today. Valuation sets how *far* a market can fall, never *when*. Keeping it in a timing score guarantees a permanently elevated reading — the boy who cried wolf, encoded. |
| Risk Appetite & Volatility | 30% | Mixed. Put/call is noisy and roughly coincident. Sentiment surveys have weak documented lead. Short interest is a positioning measure, not a warning. |
| Macro | 20% | **This is where the lead actually lives.** Yield-curve and credit-spread signals are the best-documented advance warnings in the literature — and this is the *smallest* pillar. |

**Summary: roughly half the composite is made of inputs that cannot lead, and the pillar that
can lead is weighted lowest.** Re-weighting the existing set (P6-35) does not fix this. The
set itself is wrong for the job.

There is also a structural problem worth naming: **the four pillars are averaged into one
number.** Averaging a slow-moving valuation gauge with a fast-moving volatility gauge produces
something that is neither — it cannot spike when a trigger fires, because three-quarters of it
did not move. A composite designed to be smooth cannot also be an alarm.

---

## 3. Design principles

Carried forward from E-6, plus what this assessment adds:

1. **Demonstrated lead, or no weight.** An indicator earns score weight only after this site's
   own backtest measures its lead time and false-positive rate. Literature claims are a reason
   to *test* something, never a reason to ship it weighted.
2. **Discrete crossings beat drifting composites.** "The 10Y-3M spread went negative" is
   actionable. "The composite rose from 41 to 46" is not. Prefer signals with a state change.
3. **Coincident indicators display, they do not score.** They belong on the page — they tell
   you whether the thing you feared is now happening — in their own clearly-labelled section.
4. **Missing data is missing.** Everything the 2026-08 audit established stands: no constants,
   no LLM guesses at published figures, `null` renders as "—".
5. **Every scored signal shows its own record.** Next to each: *"fired 14 days before the 2022
   top; 2 false alarms in 25 years."* If we cannot fill that sentence in, it does not score.
6. **One number is not enough.** See the two-gauge structure below.

---

## 4. Proposed structure: two gauges, not one composite

### Gauge A — **Vulnerability** (slow, "how bad would it be")
Answers: *if something breaks, how far does this market fall?*
Moves over months. **Never triggers an action on its own.**
Inputs: valuation (CAPE, Buffett, forward P/E), concentration (Mag7 share), margin debt,
household equity allocation.
This is where today's Valuation pillar belongs — honestly labelled as context, not timing.

### Gauge B — **Trigger** (fast, "is something breaking now")
Answers: *has the probability of a drawdown starting in the next 1-3 months risen?*
This is the score that matters, and the only one allowed to say "move to cash".
Inputs: only indicators with measured lead time. Candidates in §5.

### The output the user actually sees
Not a 0-100 blend. A **state** plus its evidence:

```
TRIGGER: ELEVATED  (3 of 9 leading signals firing, 21 days)
  ✓ HY credit spread widened 87bp in 20 days   [led 3 of 4 reference drawdowns, median 34d]
  ✓ NFCI turned positive                        [led 4 of 4, median 61d]
  ✓ Breadth divergence: index high, % >200DMA falling  [led 2 of 4, median 40d]
  — 6 others quiet
VULNERABILITY: HIGH — CAPE 34 (91st percentile since 1990)
  Context only. This has been HIGH since 2017 and is not a timing signal.
```

Combining Vulnerability × Trigger gives the position-sizing answer Joel actually wants:
high vulnerability *and* a firing trigger is the move-to-cash case. High vulnerability alone
is the last nine years.

---

## 5. Candidate indicators for Gauge B

**Every lead-time figure below is a claim from the literature, recorded here as a reason to
test — not a result.** The engine in §6 replaces each one with a measured number, or removes
the indicator. Series IDs must be probed before use (401/404 discrimination, as with Quiver).

### Already stored — test these first, they cost nothing

| Signal | Series | Claimed lead | Notes |
|---|---|---|---|
| Yield-curve inversion | `T10Y2Y` | 12-18 months to recession | Long lead, few signals. Recession ≠ market top, so measure against drawdowns directly. |
| HY credit spread level & **velocity** | `BAMLH0A0HYM2` | weeks-months | **Velocity is likely the signal, not level.** A 20-day widening rate is a state change; the level drifts. |
| VIX term structure | `VIXCLS`,`VXVCLS` | days | Probably coincident. Test honestly; expect it to fail and become display-only. |
| Fed funds / real rate | `DFF` + `CPIAUCSL` | months | Policy tightening precedes most drawdowns. |
| Dollar index | `DTWEXBGS` | weeks | Dollar spikes accompany risk-off. Likely coincident. |
| RRP drain / liquidity | `RRPONTSYD` | weeks-months | Liquidity withdrawal. Short usable history. |

### Free from FRED, not yet wired — highest expected value

| Signal | Series | Claimed lead | Why it is on this list |
|---|---|---|---|
| **10Y-3M spread** | `T10Y3M` | 12-18 months | The Estrella–Mishkin predictor. Better recession record than 10Y-2Y and we do not store it. |
| **Chicago Fed NFCI / ANFCI** | `NFCI`, `ANFCI` | weeks-months | A *purpose-built* weekly financial-conditions index, back to 1971. If any single free series belongs in this score, it is this one. |
| St. Louis Fed stress index | `STLFSI4` | weeks-months | Second opinion on the same question; useful as confirmation. |
| **HY − IG differential** | `BAMLC0A0CM` vs HY | weeks-months | Quality *dispersion* often moves before the level does. |
| Initial jobless claims | `ICSA` | weeks-months | Weekly, revised little, turns before payrolls. |
| Building permits | `PERMIT` | months | Classic leading component; slow. |
| Consumer sentiment | `UMCSENT` | months | Weak alone; possibly useful in combination. |

### PROBED 2026-08-10 — measured, not assumed

Every ID above was fetched from FRED and its actual history depth recorded. This replaces the
"25+ years" claim with numbers:

| Series | Resolves | History starts | Observations | Latest reading |
|---|---|---|---|---|
| `T10Y3M` | yes | **1982-01-04** | 11,636 daily | +0.78 (2026-08-07) |
| `NFCI` | yes | **1971-01-08** | 2,901 weekly | −0.529 (2026-07-31) |
| `ANFCI` | yes | **1971-01-08** | 2,901 weekly | −0.543 (2026-07-31) |
| `STLFSI4` | yes | **1993-12-31** | 1,702 weekly | −0.5063 (2026-07-31) |
| `BAMLC0A0CM` | yes | **2023-08-08 ⚠** | 796 daily | 0.78 (2026-08-06) |
| `ICSA` | yes | **1967-01-07** | 3,110 weekly | 199,000 (2026-08-01) |
| `PERMIT` | yes | **1960-01-01** | 799 monthly | 1,374 (2026-06-01) |
| `UMCSENT` | yes | **1952-11-01** | 885 monthly | 49.5 (2026-06-01) |

**Two things this probe changed:**

1. **RE-PROBED, and it is worse than one bad ID: the whole ICE BofA family is capped at three
   years on this endpoint.** `BAMLC0A0CM`, `BAMLC0A0CMEY`, `BAMLC0A4CBBB` **and
   `BAMLH0A0HYM2`** — the high-yield spread the site *already* stores and uses — all return
   exactly 796 rows starting 2023-08-08, even with an explicit `cosd=1990-01-01`. Identical row
   counts and identical start dates across four unrelated series is a family-level restriction,
   almost certainly ICE's redistribution licence, not four coincidences.
   **This corrects a claim made earlier in this document's own drafting:** the HY credit spread
   was described as testable back to 1996. On this access path it is not.
   **Consequence for the design — do not skip this.** Credit spreads are one of the two
   best-documented leading signals and, if three years is all that is obtainable, they cannot be
   backtested against 2008 or 2020 at all. That leaves the backtestable core as **NFCI/ANFCI
   (1971), T10Y3M (1982) and ICSA (1967)** — still enough to cover all four reference drawdowns,
   but a materially thinner Gauge B than §5 assumed.
   **ANSWERED 2026-08-10, and it is the bad branch.** The keyed API returns
   `count: 793`, first observation **2023-08-11** — identical to the public CSV. **The three-year
   cap is the ICE licence, not an endpoint quirk.** Therefore: **credit spreads CANNOT be
   backtested.** No 2008, no 2020, no 2022 top. `hy-spread-widening` is demoted to display-only
   — it can show a current reading and can never earn weight, because nothing can measure its
   lead time. **Gauge B now rests on NFCI/ANFCI (1971), T10Y3M (1982), STLFSI4 (1993) and ICSA
   (1967)** — still covering all four reference drawdowns, but on financial-conditions and
   labour-market evidence rather than credit. If credit lead time is ever wanted, it needs a
   paid source with history, which is a budget question (§8 decision 5: bring the measured case
   and the cost).
   *Original note, kept because it explains a real local-environment defect:* `FRED_API_KEY` is present in
   `.env.local` but **empty** (declared, zero length), so the API returns 400 from this machine.
   The key lives in Vercel — production serves real FRED data — which means this question can
   only be settled from an environment that holds it. **This is an owner action of about thirty
   seconds**, and it decides whether credit spreads can carry any weight at all:

   ```
   https://api.stlouisfed.org/fred/series/observations?series_id=BAMLH0A0HYM2&api_key=YOUR_KEY&file_type=json&observation_start=1990-01-01&limit=1&sort_order=asc
   ```

   Read the `date` on the single observation returned. **1996-12-31 → the ICE series have full
   history through the keyed API, the public CSV was the only thing truncating them, and §5
   stands unchanged. 2023-08-08 → the licence caps them everywhere**, credit-spread signals
   become present-day display indicators with no measurable lead time, and Gauge B is built on
   financial-conditions and labour-market series instead.

   *(Worth noting separately: an empty `FRED_API_KEY` locally means no FRED-dependent code path
   can be exercised on this machine — every local test of those routes has been running against
   a 400. Not a production defect, but it explains why FRED behaviour has only ever been
   verifiable on staging.)*
2. **NFCI/ANFCI reach 1971 and cover all four reference drawdowns**, which makes them the
   strongest free candidates by history alone. `T10Y3M` from 1982 covers 2000, 2008, 2020, 2022.
   `ICSA` from 1967 covers everything.

So the macro case can be tested against all four reference drawdowns on free data. **The
credit case cannot, on this access path** — see item 1 above. That distinction was invisible
until the series were actually fetched, which is the argument for probing before designing.

**All free, all through the FRED key already in place, most with 25+ years of history.**
This is the finding that matters commercially: **the macro/credit case can be backtested
against 2000, 2008, 2020 and 2022 without spending a penny.**

### Needs price history (Polygon) — test after the free set

| Signal | Claimed lead | Notes |
|---|---|---|
| **Breadth divergence** (index at highs, % >200DMA falling) | weeks-months | The classic topping tell. E-6a already computes breadth; it needs history, not new code. |
| New highs vs new lows | weeks | Same family, cheaper to compute. |
| Advance/decline line divergence | weeks | Same family. |
| Defensive-sector relative strength (XLU/XLP vs SPY) | weeks | Rotation into defensives often precedes the index turning. |

### Already licensed, unproven — test, expect to drop

Quiver's congress trading, off-exchange short volume, lobbying, government contracts. No
credible evidence of drawdown lead. They stay display-only unless the engine says otherwise.

### Explicitly NOT in Gauge B
CAPE, Buffett indicator, forward P/E, Mag7 concentration, margin debt → **Gauge A**.
QQQ SMA breaches, consecutive down days, spot VIX level → **coincident display section.**

---

## 6. The evidence engine — build this before touching a single weight

Nothing above becomes a weight until the site measures it. Required, in order:

1. **Raise retention.** `prune_market_closes` keeps 1,100 days ≈ 3 years. Backtesting 2000 and
   2008 needs ~9,000. **This is the single blocking change** — until it is done, the backtest
   is guaranteed to answer `insufficient-history`, exactly as `lib/breadth-backtest.ts`
   correctly did in E-7e.
2. **Wire and backfill the new FRED series** (§5), 25 years each. The `?backfill=` path already
   exists on the snapshot cron.
3. **Define the reference drawdowns as data**, not prose: start date, trough date, depth, for
   2000-03, 2007-09, 2020-02, 2022-01, plus the ≥10% corrections in between. The corrections
   matter more than the crashes — there are more of them, so they carry the statistics.
4. **Generalise `lib/breadth-backtest.ts` into a per-indicator lead-time scorer.** It already
   has the right shape and the right refusal behaviour. For each candidate it must emit:
   median lead, hit rate over the reference set, false-positive count per decade, and
   persistence. `insufficient-history` stays a valid verdict.
5. **Derive weights from the measurements.** Proposal: weight ∝ hit rate ÷ false-positive rate,
   normalised — so a signal that fires 4-for-4 with one false alarm outranks one that fires
   4-for-4 with nine. Publish the table.
6. **Walk-forward, not in-sample.** Fit on 1990-2010, test on 2010-2026. An indicator tuned on
   the same crashes it is scored against will look perfect and predict nothing. **This is the
   step most likely to be skipped and the one most likely to invalidate everything.**

---

## 6a. FIRST MEASUREMENT — 2026-08-10

Phase 1 ran end to end against real history. **This section is a result, not a
proposal.** Every number came from `/api/admin/ccpi-backtest` over 22,560 stored
observations and the 11 reference drawdowns.

### Lift by lead window (1.0 = chance; 1.2 is the bar to earn weight)

| Signal | 90d | 180d | 365d | 540d | FP/decade |
|---|---|---|---|---|---|
| **curve-10y3m** | **1.74** | 0.88 | 1.04 | 0.85 | 5.8 |
| **nfci-tightening** | **1.45** | 0.73 | 0.37 | 0.53 | 2.3 |
| stlfsi-stress | 0.92 | 0.46 | 0.23 | 0.34 | 3.7 |
| vix-backwardation | 0.41 | 0.51 | 0.74 | 0.97 | 23 |
| claims-rising | 0.00 | 0.28 | 0.28 | 0.20 | 6.5 |

`curve-10y2y` and `hy-spread-widening` returned `insufficient-history` at every
window — both series are capped at ~3 years (§5).

### Two lessons that must not be relearned

**1. A hit rate without a base rate is worthless.** `vix-backwardation` at 540
days caught **100% of drawdowns** — every one — with precision 0.54. Its base
rate was 0.56. **Lift 0.97: worse than a coin flip.** With 11 events and an
18-month window, most of history *is* "before a drawdown", so a signal firing
twice a year cannot avoid preceding things. On the first metric it ranked top;
it is in fact the worst signal tested. Any future metric that cannot produce
this result is the wrong metric.

**2. Widening the window destroys lift.** This document originally argued the
opposite — that a 180-day cap suppressed the curve's documented 12-18 month
lead, and that testing at its own horizon would vindicate it. **Measured, the
reverse holds for every signal without exception:** lift falls monotonically as
the window widens, because the base rate grows faster than precision. A wider
net catches more events and proportionally more noise. Whatever information
exists here is at **90 days**, not 12-18 months.

**3. Selecting a parameter on data the test can see is not a test.** The
walk-forward originally chose each signal's lead window from the *full-sample*
sweep, then scored it out of sample at that window. `claims-rising` exposed it:
its best lift across all six windows on fit data was **0.28** — never once
beating chance — and it still returned a test lift of **2.41**. That is the
window being picked because it happened to work later, dressed as validation.
**A leaky gate is worse than no gate, because the output looks confirmed.**
Window selection now uses the fit period alone. Any future hyperparameter —
threshold, persistence, split date — must be chosen the same way.

### Assignment

- **Trigger — two PROVISIONAL candidates, at 90 days only.** `curve-10y3m`
  (lift 1.74) and `nfci-tightening` (lift 1.45). Both clear the bar. Both also
  miss 9 or 10 of 11 drawdowns, so they are a tilt, not an alarm — and neither
  earns weight yet, for the reason below.
- **Coincident:** `vix-backwardation`. Below chance at every window, exactly as
  its own recorded hypothesis predicted.
- **Dropped:** `stlfsi-stress` (never beats chance; the "redundant with NFCI"
  prediction confirmed) and `claims-rising` (worst at every window).
- **Untestable:** `curve-10y2y`, `hy-spread-widening`.

### Why nothing scores yet

**Five signals × four windows is twenty tests, and two came back positive.**
That is precisely the yield you would expect from noise. Neither survivor earns
weight until walk-forward — fit on 1990-2010, score on 2010-2026 — reproduces
the 90-day result out of sample. §6 step 6 required this before any of it was
run; it is now the single gate between here and a scored gauge.

---

## 6b. WALK-FORWARD VERDICT — 2026-08-10, FINAL. Nothing is confirmed.

Run with the window chosen on the **fit period only** (the leaky version and its
two spurious `test-only` verdicts are described as lesson 3 in §6a).

| Signal | Window | Fit lift | Test lift | Verdict |
|---|---|---|---|---|
| nfci-tightening | 60d | 5.79 | **0** | `fit-only` |
| stlfsi-stress | 60d | 3.09 | **0** | `fit-only` |
| curve-10y3m | 90d | 2.85 | **1.11** | `fit-only` |
| claims-rising | 30d | 0 | 0 | `failed` |
| vix-backwardation | — | — | 0.49 | `insufficient` |

**Read the pattern rather than the rows.** Every signal with an in-sample case —
5.79, 3.09, 2.85 — collapsed out of sample to 0, 0 and 1.11. That is not one
weak indicator; it is the systematic signature of overfitting across the whole
candidate set, produced independently by three unrelated series. Closing the
window-selection leak also removed both `test-only` verdicts, which is
corroboration that the fix was correct rather than merely different.

### Conclusion

**No freely available macro series times equity drawdowns at any horizon
tested (30 to 540 days).** Twenty-eight window-tests, three in-sample
positives, **zero confirmed**. **Trigger ships empty**, exactly as §7a
specified it should when nothing has earned weight.

A result, not a failure. The requirement was a gauge that warns before a
drawdown; the honest answer from this site's own data is that these inputs do
not, and it is known now rather than after trading on it. Shipping NFCI on its
5.79 in-sample lift would have produced an authoritative-looking gauge with zero
out-of-sample value — and without the walk-forward gate, that is exactly what
would have happened.

### What is still open, in priority order

1. **Breadth divergence.** Logic built and proven (`breadthDivergence` in
   `lib/ccpi/signals.ts`, 5 checks). **WIRED 2026-08-10** — it is scored in
   `/api/admin/ccpi-backtest` and now appears as a live Trigger row from
   `/api/ccpi-signals`. Needs stored closes plus `breadth_daily` rather than
   FRED, which is why it is handled separately from the signal registry in both
   places. **It will read `NO DATA` for some time and that is correct, not a
   defect:** breadth spends ~280 calendar days of closes computing its first
   200-day average, and the signal needs 60 more days of *overlap* with stored
   SPY closes on top. The row states the shortfall in its own words — "needs 61
   overlapping days, have N" — so the clock is visible rather than inferred.
   The only candidate with prior support never tested here.
2. **Credit with real history.** The ICE licence cap (§5) made the
   best-documented precursor untestable. A paid source reaching 1996 is the only
   way to answer it, and it is now the single budget question worth asking.
3. **Everything else is closed.** NFCI, STLFSI4, ICSA, both curves and the VIX
   term structure have been measured and none earns weight.

---

## 7. Migration

Phased so the site is never in a broken half-state:

- **Phase 1 — evidence.** §6 steps 1-4. No user-visible change. Ends with a measured
  lead-time table for every candidate.
- **Phase 2 — restructure.** Split the page into Trigger / Vulnerability / Coincident.
  Trigger initially shows the measured signals **unscored**, exactly as E-6a did for breadth.
  Specified in §7a below.
- **Phase 3 — score.** Turn on weights derived in step 5, each with its record beside it.
- **Phase 4 — retire.** Remove the old composite, or keep it clearly labelled as "legacy
  conditions score" if it is still wanted for continuity.

The audit's data-integrity work is a prerequisite for all of this and is already done: without
P6-31/32/34 the backtest would have been measuring LLM guesses and fallback constants.

### 7a. Phase 2 in detail — the page, before anything scores

Phase 1 is code-complete: retention at 9,000 days, seven signals defined, the lead-time scorer
and its 25 checks, the reference drawdowns, `/api/admin/ccpi-backtest`, and a per-series
coverage readout. Phase 2 is the **only** phase that changes what a visitor sees, and it changes
it before a single weight exists. That ordering is deliberate — see "why unscored first" below.

#### AMENDED 2026-08-10 after UAT — the sections stayed, the grouping did not

Phase 2 shipped exactly as specified below and was reviewed on staging the same day.
**The owner rejected the three-section grouping and kept the pillar numbering.** The page
order is now:

1. the CCPI score card, with the crash amplifiers and Active Warning Signals attached to it,
2. **TRIGGER**,
3. **Pillar 1 Momentum**, 4. **Pillar 2 Risk Appetite**, 5. **Pillar 3 Valuation**, 6. **Pillar 4 Macro**.

**What was actually being protected here was the labelling, not the layout, and the labelling
survived intact.** Grouping Momentum under a "Coincident" header and Valuation under a
"Vulnerability" header was one way to tell the reader that the first confirms rather than
predicts and the second says how far rather than when. It is not the only way. Those two
statements now ride on the pillars themselves: `PillarMomentum` and `PillarValuation` each
take a `badge` (a short role label, rendered in the accordion trigger so it is visible while
the section is collapsed) and a `caveat` (the full sentence, rendered when it is open).
A reader still cannot expand Momentum without being told it does not predict.

**Do not "restore" the grouped layout.** It was seen, considered and replaced by the owner,
and reverting it would trade a working page order for a header arrangement that carried no
information the badges do not carry. Everything in "What Phase 2 must NOT do" below still
binds — no score, no gauge, no row without its record, no `NO DATA` rendered as `QUIET`, no
reordering rows by importance.

**All four pillars now open on load, which overrides "collapsed by default" in item 3
below.** Same reasoning as the grouping, applied one level down: the point of collapsing
the coincident section was to stop a reader treating those indicators as predictive, and
the `COINCIDENT` badge sits in the accordion trigger where it is visible open or shut, with
the full caveat inside. A collapsed section communicates "less important", which is vaguer
than the sentence actually printed on it. Do not re-collapse it to satisfy the older
wording.

**The general rule these two amendments share:** §7a's layout instructions were always
proxies for statements about what an indicator can and cannot do. Where the statement is
made directly and unmissably, the proxy has done its job and can go. Where it is not, the
proxy stands.

*One further UAT change, recorded here because it touched the same commit:* the five-column
portfolio allocation table was replaced by a single cash-vs-stocks ratio per regime, now
living in `lib/ccpi/allocation.ts`. That consolidation exposed a defect worth naming — the
old five columns never summed to 100, and the options-strategy card separately claimed
"cash 5-10%" beside "exposure 90-100%", which sums to 110. **Cash is now the only stored
figure and stocks is computed as its complement**, so the two halves cannot disagree again.
`bandForScore` returns `null` for a missing score rather than defaulting to the benign first
band, which is the P6-30 rule applied to allocation.

*The original specification follows, and is otherwise unchanged.*

#### Three sections, in this order

**1. TRIGGER** — the actionable one, at the top.

Each evaluable signal gets one row:

```
●  Financial conditions tighter than average        QUIET      NFCI −0.529 · 31 Jul
   Chicago Fed index above zero                                lead: untested
●  10Y-3M curve inverted                            QUIET      +0.78 · 7 Aug
●  Credit spreads widening fast                     NO DATA    needs 20-day history
```

Every row carries four things and never fewer: **state** (firing / quiet / no data), **the
reading and its date**, **what firing would mean** in one line, and **its record** — which
during Phase 2 reads `lead: untested` for every signal, because it is. A row missing its record
is a row asserting something it has not earned.

The section header states the count and nothing more: `TRIGGER — 0 of 7 firing`. **No composite
number, no gauge, no colour-graded dial.** There is nothing to compute a number from yet, and
inventing a 0-100 reading from unweighted signals would be precisely the defect this redesign
exists to remove, reintroduced at the last moment for the sake of a familiar-looking widget.

**2. VULNERABILITY** — context, visually quieter, explicitly not a timing signal.

Valuation, concentration, margin debt. Carries a permanent one-line caveat: *"This has been
elevated since 2017. It describes how far a fall could go, not when."* Today's inputs are
largely unsourced (P6-34 removed the LLM guesses), so most of it renders "—" — which is honest
and, for once, also instructive: it shows the reader how thin this evidence actually is.

**3. COINCIDENT** — collapsed by default, clearly labelled. *(Superseded on the collapse
point by the UAT amendment above: it ships expanded, carrying its label as a badge. The
labelling requirement is unchanged and still binds.)*

QQQ SMA breaches, consecutive down days, spot VIX level, VIX term structure. These tell you a
decline is **already underway**. Useful for confirmation, worthless for warning, and mixing them
into the Trigger list is exactly how the current CCPI came to be 35% coincident. The header says
so in plain words: *"These confirm a decline that has started. They do not predict one."*

#### Why unscored first, and not "just briefly"

E-6a shipped market breadth unscored and it was the right call: the indicator was visible, its
provenance was legible, and nothing in the headline number depended on a claim nobody had
tested. Phase 2 repeats that deliberately.

The risk being managed is specific. Once a number exists on screen, it acquires readers and
screenshots and expectations, and removing it later becomes a negotiation rather than a
correction. Shipping the sections **without** a score means the walk-forward results in Phase 3
can freely delete signals — which they will, since the whole point is that some fail — without
anyone having to defend a number that was never justified.

#### What Phase 2 must NOT do

- **No score, no gauge, no 0-100 anything.** Not even "provisional".
- **No signal shown without its record.** `lead: untested` is a fact; a blank column is a lie by
  omission.
- **No inferring a state from a missing reading.** A signal with no data reads `NO DATA`, never
  `QUIET`. This is the P6-30 defect (a dead feed rendering as "Neutral") and it would be
  unforgivable to reproduce it in the component built to replace that thinking.
- **No reordering rows by "importance".** Until the backtest has spoken there is no importance,
  and an ordering implies one. Alphabetical, or grouped by data source.

#### Definition of done for Phase 2

Trigger appears as its own section with every row showing state, reading, date, meaning and
record; no number anywhere claims to aggregate them; the coincident and vulnerability roles
are stated on screen wherever those indicators appear (as section headers in the original
specification, as pillar badges after the UAT amendment above); and a reader who knows nothing
about the redesign can tell, from the page alone, which signals are measured, which are
untested, and which have no data at all.

---

## 8. Decisions needed from the owner

1. ~~**Two gauges, or keep one number?**~~ **DECIDED 2026-08-10: two gauges (Layout A).** Chosen
   after a side-by-side mockup fed five live FRED readings —
   https://claude.ai/code/artifact/b96605b8-15b1-4d0f-9225-dc4a9cd18cdc . Today's data made the
   case on its own: every leading signal was quiet (10Y-2Y +0.46, 10Y-3M +0.78, HY OAS 2.71%,
   NFCI −0.529, VIX 15.15), and the two-gauge layout reads `QUIET — 0 of 5 firing` while the
   single composite reads `—`, because two of its four pillars are null. **The deciding
   argument was degradation, not aesthetics:** a gauge consulted before moving to cash has to
   stay readable on the day it matters. Layout A degrades to "3 of 5 firing"; Layout B degrades
   to a dash, and it does so precisely when data is thin — which is when drawdowns happen.
2. ~~**Retention**~~ **DECIDED: raise `prune_market_closes` to 9,000 days (~25 years).** Covers
   2000, 2008, 2020 and 2022. This is the blocking change — until it lands the backtest is
   guaranteed to answer `insufficient-history`. Migration, plus a change to a nightly job that
   is currently deleting exactly the history the backtest needs.
3. ~~**Walk-forward discipline**~~ **DECIDED: yes — fewer, better signals.** Fit on 1990-2010,
   score on 2010-2026. Indicators that fail their own test are removed, and the resulting gauge
   is expected to fire *less* often than today's. This is the decision that separates an
   instrument from a dashboard: an indicator tuned on the same crashes it is scored against
   looks perfect and predicts nothing.
4. ~~**What "move to cash" means numerically**~~ **DECIDED: the data sets it.** Derive the
   threshold from the backtest — the firing count and duration with the best hit-rate to
   false-alarm ratio ahead of the reference drawdowns — and bring the number back with its
   record for approval. **Do not pick a round number and justify it afterwards.**
5. ~~**Budget**~~ **DECIDED: free set first.** Build and measure on FRED plus the existing
   Polygon / Quiver / FMP plans only. A paid source is proposed only if the backtest shows a
   specific, measured lead-time gain, and then with its cost stated. The $79/mo committed
   ceiling stands until then.

**All five decisions are now taken. Phase 1 may begin without further sign-off.**

---

## 8a. Polygon history depth — what each year buys

Computed 2026-08-10 from `REFERENCE_DRAWDOWNS`, a 90-day runway requirement and
breadth's ~280-day warm-up. **The decision this replaces is a hunch about
"more history would help".**

| Closes from | Breadth from | Testable events |
|---|---|---|
| **5y — current plan** | 2022-05 | **1 of 11** |
| 6y | 2021-05 | 2 |
| 7y | 2020-05 | 2 |
| **8y** | 2019-05 | **3 — the floor** |
| **10y** | 2017-05 | **5** |
| 15y | 2012-05 | 6 |
| 20y | 2007-05 | 9 |
| 30y | 1997-05 | 11 |

**There is no partial credit.** Three covered events is the minimum the scorer
accepts, so 6 and 7 years buy nothing usable — the signal still cannot be
scored. The decision is binary: does the next tier reach **8 years or more**.

**10 years is the value point.** Five events, including COVID-2020 and the two
2018 corrections, which are genuinely different regimes from 2022-23 rather than
more of the same. Beyond that the curve flattens hard: 15 years adds one event,
and reaching 9 needs 20.

**The warm-up is a real cost and easy to forget.** Breadth spends ~280 calendar
days of closes computing its first 200-day average, which is why five years of
closes yields only four years of breadth. Any depth purchased loses a year off
the front before it counts.

**Not priced here.** The tier names, costs and history depths must be read off
Polygon's current pricing against the live subscription — asserting them from
memory is the mistake §5 already made with the ICE series. The question to take
to that page is narrow: *what does the next tier up cost, and does it reach
eight years?*

---

## 8b. P7-73 — the FRED Buffett basis, measured, and a band proposal (2026-08-14)

**The question:** `lib/ccpi/buffett-indicator.ts` computes NCBEILQ027S/1000 ÷ GDP — free,
keyless, 55 years deep — but its basis (nonfinancial corporate equities) is not the
total-market-cap basis the CCPI's bands (>200/>180/>150/>120) were calibrated against.
Measured the week of 2026-08-14: FRED basis **218.1**, GuruFocus **183.8**. A naive swap
moves the indicator 13 → 16 points and reads as the market moving.

**Method that was tried and REJECTED, stated so nobody re-tries it:** translating the old
cutoffs through a total-market index. Yahoo's `^DWCF` (Dow Jones US Total Stock Market,
full cap) has quarterly history to 1995 and regresses against the FRED basis at r²=0.98 —
and fails its own sanity check: scaled to today's 183.8, it puts the March-2000 top at
**114%**, when the indicator's own well-documented 2000 reading is ~140%. A full-cap
*price* index misses net issuance (IPOs add cap without moving it; buybacks remove cap),
so its scale drifts across decades. The r² was trend, not mapping. FRED's own Wilshire
series (`WILL5000PRFC` et al.) would have settled it, but FRED removed them entirely —
404, data and all — when the Wilshire licence ended in 2024.

**What stands is the FRED series' own history** (225 quarterly observations, 1970-Q1 →
2026-Q1, refetchable keyless via `scripts/analysis-buffett-bands.mjs`; the two
`fredgraph.csv` downloads are the only inputs):

| | value |
|---|---|
| entering dot-com top (2000-Q1) | 162.6 |
| entering GFC (2007-Q3) | 120.6 |
| entering covid (2020-Q1) | 128.8 |
| entering 2022 bear (2021-Q4) | 218.7 |
| all-time max (2025-Q4) | **228.7** |
| latest (2026-Q1) | **218.1** |
| percentiles since 1995 (n=125) | p50 = 120.8 · p75 = 150.8 · p90 = 198.0 · p95 = 210.7 |

**Proposed ladder, percentile-matched to the modern era:** `>210 / >195 / >150 / >120`
(p95 / ~p90 / ~p75 / ~p50). The lower two rungs land on the existing cutoffs by
coincidence of the distribution, so **only the top two cutoffs move** (200→210, 180→195).

**Lead-time record on this basis, run the E-6 way:** `>210` first fired **2021-Q2 (216),
three quarters before the 2022 bear start** — a real lead on the one valuation-driven
episode. It never fired ahead of 2000, 2008 or 2020: the GFC and covid were not
valuation unwinds, and on THIS basis the dot-com top only reached 162.6 — nonfinancial
corporate equities simply were not where that bubble's cap sat. Anyone reading the
gauge should know the indicator is a one-crash-in-four leader on either basis.

**The divergence that needs a decision, stated plainly:** today the two bases disagree
about where the market sits relative to their own histories. The FRED basis reads 218.1
against its p95 of 210.7 — inside the top band, at roughly the 97th percentile of the
modern era, 10 points under its all-time high; five of the last six quarters sat above
210. The scraped basis reads 183.8 — its second band, below its own 2021 extreme. So on
the proposed ladder the FRED basis scores **16** where the scraped basis scores **13**
today. That is not a calibration error to be smoothed away; the two series genuinely
rank the present differently, and picking a basis is picking which story the pillar
tells.

**Decision for the owner — one of:**
- **(a) Adopt the FRED basis with the proposed ladder** (>210/>195/>150/>120), retiring
  the ScrapingBee/GuruFocus scrape for this input. Free, keyless, survives any provider,
  and the band derivation is reproducible from public data. Valuation gains 3 points
  today relative to the scrape — disclosed above, not hidden.
- **(b) Keep the scraped basis as primary, FRED as fallback through its OWN ladder** —
  never through the scraped ladder. Costs the ScrapingBee dependency P7-74/P7-75 mapped;
  keeps continuity with the bands' original meaning.
- **(c) Leave it unwired** (today's state): the series accumulates in `market_series`
  and the CCPI keeps scoring the scraped figure when ScrapingBee has a key, nothing
  otherwise.

Until one is chosen, nothing changes in scoring — `computeBuffettIndicator` stays
deliberately unwired, exactly as P7-73 left it.

---

## 9. What this document deliberately does not do

It does not re-weight anything, and it does not assert that any indicator works. Every lead
time in §5 is a hypothesis. The whole point of §6 is that this site has spent a fortnight
removing invented numbers, and replacing them with confidently-asserted lead times taken from
memory would be the same mistake in a more expensive form.
