# Ticker Research Queue — design spec

A background research pipeline: add a ticker to a queue, and get back one
options-focused recommendation — **should we run the wheel, sell puts, buy a
LEAPS, sell calls against shares, or exit** — with the numbers behind it.

Status: **design, not built.** Written 2026-08-31.

## What it answers

For each queued ticker, one structured recommendation:

- **CSP** — sell cash-secured puts (wheel entry): "sell the 0.25Δ put around $92"
- **CC** — sell covered calls against shares we hold (wheel income/exit)
- **LEAPS** — buy a deep-ITM long-dated call as a stock replacement: "buy a
  LEAPS if it drops to $XX"
- **LONG_CALL** — defined-risk bullish
- **PMCC** — poor-man's covered call (short call against a LEAPS)
- **NO_TRADE** — including "we hold shares and the read is Sell → exit, don't
  invent a bearish options trade"

Plus, for any tradeable rec: IV read, strike (by delta, tied to a level), DTE,
probability of profit, credit, breakeven, max profit / effective basis,
annualized return on capital, a mechanical management plan (take profit ~50%,
roll ~21 DTE, wheel if assigned), and a smaller defined-risk alternative.

## Provenance and licence

The decision framework and the recommendation schema are **ported from the
owner's local `C:/CODING/TradingAgents`** (`agents/options/options_strategist.py`
and its `OptionsRecommendation`/`PortfolioRating`/`wheel_profile`). That project
is **Apache-2.0** — porting the logic into this app is fine; keep a NOTICE
attribution line. We port the *logic and the prompt*, not the Python.

**The one deliberate change, and it is the whole point.** TradingAgents runs the
strategist as one node in a 7–12-agent LangGraph debate, and asks the LLM to
*estimate* the methodology numbers ("if live option quotes are unavailable, give
clearly-labeled estimates"). This app already computes those numbers for real —
Polygon ATM IV, `lib/black-scholes.ts` deltas/price/POP, the `wheel.ts`/`leaps.ts`
strike pickers. **So we compute every number and let the LLM only *select the
strategy and write the rationale*.** The debate, the TUI and the audio are
dropped. Cost falls from ~10 LLM calls per ticker to **1**.

## Architecture — Path A, entirely in the existing stack

No Python service, no second data source. Next.js route + Supabase + the
existing async-enrichment pattern (`enrichWithOptionsData`, which already prices
candidates with a progress callback). Runs server-side, kicked off when a ticker
is queued; no client stays open.

```
Add-to-queue  →  research_queue row (pending)
                        │
   background job (reuses enrichWithOptionsData shape)
                        │
   1. COMPUTE (OC's audited math, never the LLM):
        price            getStockPrice (Polygon)
        ATM IV + IV rank fetchIVSnapshot + IV-history percentile
        CSP strikes      invert calculatePutDelta to the wheel_profile
                         delta band, floored at a support level (200-DMA
                         or % pullback)
        credit / POP     calculateOptionPrice / (1 − delta) / probabilityITM
        breakeven, ROC   strike − credit ; credit/capital × 365/DTE
        LEAPS strike     ~0.75–0.80Δ call ≥ leaps_min_dte (leaps.ts)
        earnings-in-DTE  the earnings calendar route
   2. RATE (directional): fundamental score + technical trend + CCPI regime
        → PortfolioRating (Buy/Overweight/Hold/Underweight/Sell).
        Deterministic and free; optional one Opus 5 "PM" pass for depth.
   3. DECIDE (one Opus 5 call, the ported strategist prompt): given the
        computed numbers + rating + wheel_profile + shares_held, emit the
        structured OptionsRecommendation. Numbers are INPUTS; the model picks
        the strategy and explains it.
                        │
   research_queue row (researched, with the recommendation + an age stamp)
```

The reasoning chain is `lib/ai-providers.ts` (Opus 5 first), so this inherits the
metering ledger, the budget guard, and `error_class`. A recommendation whose
numbers could not be computed is stored as `NO_TRADE` with the reason — never a
guessed trade (the P6-34 / this-session rule).

## Data model (Supabase, RLS deny-all + service key, per the house pattern)

**`research_queue`** — one row per (member, ticker) request:
`id · member_id · ticker · status (pending|researching|researched|failed|stale)
· shares_held (int, default 0) · cost_basis (numeric, null) · recommendation
(jsonb: the OptionsRecommendation) · researched_at · created_at`.
Keyed by member so it is *your* queue, not shared. `shares_held`/`cost_basis`
are what make the CC-vs-exit question answerable.

**`wheel_profile`** — one row per member (ported from TradingAgents'
`wheel_profile`): `account_type (401k|taxable|ira) · willing_to_be_assigned ·
avoid_earnings_within_dte · max_capital_per_trade_usd · min_iv_rank_for_premium_sale
· target_csp_delta_range [low,high] · preferred_dte_range [low,high] ·
leaps_min_dte · leaps_target_delta [low,high]`. Sensible defaults so it works
before anyone edits it.

**Staleness:** a recommendation is priced off a moving underlying, so the row
carries `researched_at` and the tab marks it stale past a TTL (the cache-TTL
lesson — a research result that looks current but is a week old is the same
defect class as an invented one). Re-queueing re-researches.

## The recommendation (ported `OptionsRecommendation`)

`strategy (CSP|CC|LONG_CALL|LEAPS|PMCC|NO_TRADE) · ticker · rationale ·
target_strike_guidance · target_expiry_guidance · risk_flags[] · size_guidance ·
fit_score (1–5)` plus the premium-seller fields `iv_assessment ·
probability_of_profit · net_credit_or_debit · breakeven · max_profit · max_loss ·
annualized_return_estimate · management_plan · defined_risk_alternative`.

Every one of those numeric fields is **filled from the COMPUTE step**, not the
LLM. The LLM receives them and produces `strategy`, `rationale`, `risk_flags`,
`fit_score`.

## Phases (each ships and is testable on its own)

1. **Queue skeleton.** The two tables, the POST `/api/research-queue` route
   (auth-gated, recipient/member from the session — same discipline as the
   report-email route), an "Add to Research Queue" button on scanner result rows
   and ticker views, and a **Research** tab that lists the queue with status +
   age. No research logic yet — a CRUD foundation that proves the plumbing.
2. **The research job.** The COMPUTE → RATE → DECIDE pipeline above. This is the
   port. Guarded by a check that asserts the LLM prompt receives the computed
   numbers (so no future edit can quietly let the model invent them).
3. **Alerts.** "Buy a LEAPS if it drops to $XX" / "the CSP band opens at $XX"
   become a price watch on the existing market-snapshot cron; a hit flips the
   row to `actionable` and (optionally) emails the member via the existing
   Resend path.

## Cost

~1 Opus 5 call per ticker researched (plus the deterministic compute and, if
enabled, one PM pass). At two users this is immaterial; the budget guard caps it
regardless. Compare TradingAgents' ~10 calls/ticker.

## Open decisions for the owner

1. **IV rank source.** Polygon gives ATM IV now; IV *rank* needs an IV history.
   Options: store daily ATM IV into `market_series` (a small cron, like breadth)
   and compute the percentile after ~60 days; or approximate rank from realized
   vol until then and label it an estimate. (Estimate-labelled, never silent.)
2. **Directional rating depth.** Deterministic (fundamental+technical+CCPI, free)
   vs one extra Opus 5 "portfolio manager" pass for a narrative view. Start
   deterministic; add the pass behind a toggle.
3. **Where the button lives.** CSP scanner rows for sure; also the LEAPS/wheel
   tabs, and a free-form "research this ticker" box on the Research tab.
4. **Auto-refresh vs manual.** Do stale rows re-research on a cron, or only when
   re-queued? Manual first (cost + freshness are the owner's call per ticker).
