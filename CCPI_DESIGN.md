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

1. **`BAMLC0A0CM` returns only three years, not the ~1996 start the HY−IG differential needs.**
   Either the public CSV endpoint truncates this one or the ID is subtly wrong. **Re-probe
   through the keyed FRED API before building anything on it** — and if three years is genuinely
   all there is, the HY−IG differential cannot be backtested and drops out of Gauge B. Do not
   assume; this is exactly the kind of thing that becomes an invented number later.
2. **NFCI/ANFCI reach 1971 and cover all four reference drawdowns**, which makes them the
   strongest free candidates by history alone. `T10Y3M` from 1982 covers 2000, 2008, 2020, 2022.
   `ICSA` from 1967 covers everything.

So the macro/credit case can be tested against all four reference drawdowns on free data —
now verified rather than asserted, with the single exception flagged above.

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

## 7. Migration

Phased so the site is never in a broken half-state:

- **Phase 1 — evidence.** §6 steps 1-4. No user-visible change. Ends with a measured
  lead-time table for every candidate.
- **Phase 2 — restructure.** Split the page into Trigger / Vulnerability / Coincident.
  Trigger initially shows the measured signals **unscored**, exactly as E-6a did for breadth.
- **Phase 3 — score.** Turn on weights derived in step 5, each with its record beside it.
- **Phase 4 — retire.** Remove the old composite, or keep it clearly labelled as "legacy
  conditions score" if it is still wanted for continuity.

The audit's data-integrity work is a prerequisite for all of this and is already done: without
P6-31/32/34 the backtest would have been measuring LLM guesses and fallback constants.

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

## 9. What this document deliberately does not do

It does not re-weight anything, and it does not assert that any indicator works. Every lead
time in §5 is a hypothesis. The whole point of §6 is that this site has spent a fortnight
removing invented numbers, and replacing them with confidently-asserted lead times taken from
memory would be the same mistake in a more expensive form.
