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
`id · member_id · ticker · status (pending|researching|researched|failed|stale|
paused|archived) · shares_held (int, default 0) · cost_basis (numeric, null) ·
recommendation (jsonb: the OptionsRecommendation) · prev_recommendation (jsonb,
for the morning recap's "what changed") · researched_at · created_at`. `paused`
and `archived` are skipped by the nightly cron.
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

1. **Queue skeleton + the global button.** The two tables, the POST
   `/api/research-queue` route (auth-gated, member from the session — same
   discipline as the report-email route), and a **Research** tab that lists the
   queue with status + age and holds a free-form "research any ticker" box.
   The button is a **single reusable `<ResearchButton ticker={...} />`
   component** (owner decision 2026-08-31: it belongs next to EVERY ticker in
   the app, not only scanner rows). Phase 1 drops it on the CSP scanner rows and
   the free-form box; rolling it out to the remaining ticker surfaces
   (LEAPS/wheel tabs, CCPI's NVDA/SOX, insider tables, anywhere a ticker
   renders) is mechanical follow-up, one component per site. No research logic
   yet — a CRUD foundation that proves the plumbing.
2. **The research job.** The COMPUTE → RATE → DECIDE pipeline above, run on
   enqueue. This is the port. Guarded by a check that asserts the LLM prompt
   receives the computed numbers (so no future edit can quietly let the model
   invent them).
3. **Nightly refresh + morning recap** (owner decision 2026-08-31). A cron
   (`/api/cron/research-refresh`, same shape as market-snapshot, CRON_SECRET-
   gated) runs overnight and re-researches every non-archived queued ticker, so
   the queue is current every morning without anyone re-queueing. It then writes
   a **morning recap** — what changed since yesterday: tickers that flipped
   strategy (e.g. "TSLA → NO_TRADE"), CSP bands that moved, LEAPS triggers newly
   in range — surfaced at the top of the Research tab. The recap is one Opus 5
   pass over the computed deltas (numbers computed, model narrates), or
   deterministic if the LLM is unavailable. A price-trigger ("buy the LEAPS if
   it drops to $XX") rides the same cron and can email via the existing Resend
   path.

   Cost note: nightly × queue-size Opus 5 calls. At two users and a modest queue
   this is a few cents a night, and the budget guard caps it; a queue cap
   (e.g. 50 active tickers) keeps it bounded. Archived/paused tickers are skipped.

## Cost

~1 Opus 5 call per ticker researched (plus the deterministic compute and, if
enabled, one PM pass). At two users this is immaterial; the budget guard caps it
regardless. Compare TradingAgents' ~10 calls/ticker.

## Resolved decisions (owner, 2026-08-31)

1. **IV rank.** BOTH, starting now: a daily ATM-IV cron writes into
   `market_series` (history from day one, like breadth) so true IV rank exists in
   ~60 days; until then the recommendation shows a realized-vol-based IV-rank
   estimate, explicitly labelled "IV history building, N/60 days". No wait, no
   silent guess, no rework.
2. **Directional rating.** Deterministic first — fundamental + technical + CCPI
   regime, free and auditable. An optional Opus 5 "portfolio manager" narrative
   pass sits behind a per-request toggle, off by default.
3. **Button — GLOBAL.** A reusable `<ResearchButton>` next to every ticker
   everywhere in the app, plus the free-form box on the Research tab. Phase 1
   ships the component + CSP scanner rows + the box; the rest of the surfaces
   are mechanical follow-up.
4. **Refresh — NIGHTLY.** The whole queue re-researches on an overnight cron so
   it is current each morning, with a morning recap on the Research tab (see
   Phase 3). Per-ticker pause/archive keeps the nightly cost bounded; a
   re-queue still forces an immediate refresh.

## Still to settle during build

- **Queue cap** (default active-ticker limit before the nightly cost matters).
- **Recap channel** — on-tab only, or also emailed each morning via Resend.
- **What "changed" means in the recap** — strategy flips and band moves for sure;
  whether small numeric drift (a $1 strike move) is worth surfacing or is noise.
