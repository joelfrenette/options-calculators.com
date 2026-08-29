# Admin & API/Cost Infrastructure Audit — 2026-08-29

Read-only audit of the admin section, provider/key registry, AI models, and
cost/usage tracking. "LIVE" = code invokes it on a reachable path; "dead" =
named in a registry/probe/cost table but never called. Runtime `DISABLED_APIS`
and which keys are set live in Vercel/`.env.local`, not the repo — verdicts
below are code-reachability.

## Headline (corrects the framing)

**Cost & token tracking already exists — this is not a green field.**
`lib/metered-fetch.ts` logs one row per call to a durable Supabase `api_calls`
table (+ an in-memory ring buffer), LLM token+dollar accounting is
comprehensive (`recordAiCall` with input/output tokens × list price), a
**Budget Guard** (`lib/budget-guard.ts`) enforces daily/monthly hard-stops and
trips a kill flag, and **two admin surfaces already show it**: the **Costs**
tab ("Measured usage") and the **Budget-Guard panel** on the **Health** tab.

The real gaps are narrower than "no tracking": partial data-provider metering,
a split budget view, two genuinely dead providers, and some redundant admin
surfaces.

## A. Admin tabs (`app/admin/page.tsx`) — 9 tabs, all reachable, none dead

Health · Costs · APIs · AI · Data · Keys · Users · CCPI · Backup. Every tab has
a nav trigger and a rendered body. `budget-guard-panel.tsx` and
`remediation-card.tsx` are LIVE (rendered inside `HealthCheckPanel`).

**Redundancy (the real Q1 finding — overlap, not dead tabs):**
1. Key-resolution status shown in **3 places** (Health Keys table, APIs tab,
   AI tab) — plus the Keys tab that *manages* them.
2. **APIs tab ⊂ Health tab** — APIs probes vendor endpoints; Health already
   probes every route + lists key resolution + gates. Weakest-value tab.
3. **Two split budget surfaces** — flat-fee target on **Costs**; per-use spend
   vs hard-stops on **Health** (Budget-Guard). The code itself flags the
   confusion (`costs-usage-admin.tsx:271-282`).
4. APIs-vs-Data overlap is acceptable (vendor reachability vs indicator→source
   provenance) — leave.

The APIs tab still probes **Twelve Data** and **SerpAPI**, and the Costs tab
still lists them — dead on live paths (see B).

## B. Providers — 2 dead, purge

Registry `lib/api-keys.ts:24-50` + cost table `lib/api-costs.ts`. `status:"eliminate"`
in api-costs is a **cost recommendation, not a runtime state**.

LIVE: Polygon, FRED, Finnhub, FMP, Alpha Vantage (free, conditional), Apify
(unmetered — plain fetch), Quiver, ScrapingBee, Serper, Resend, all LLM keys.

**DEAD — purge** (registered/probed/costed, zero live call sites):
- **`TWELVE_DATA_API_KEY`** — its QQQ-technicals job moved to Polygon.
- **`SERPAPI_KEY`** — its Google-Trends job moved to Serper.
Remove both from `api-keys.ts`, `api-costs.ts`, `remediation-providers.ts`, and
the `api-status` probe.

## C. AI models — 2 live subsystems, 1 dead constant

- System 1 `lib/ai-providers.ts` (7-provider free→paid chain) — LIVE, surfaced
  on the AI tab (derived from code, can't drift).
- System 2 `lib/unified-ai-fallback.ts` (grok→groq→anthropic→openai) feeds the
  CCPI dashboard — the site's default landing page, so the **hottest path**.
  Not surfaced in admin.
- All 4 `lib/*-market-data.ts` files are LIVE. `grok-market-data.ts` is a
  misnamed provider *picker* (xAI→Groq→OpenAI), not Grok-only.
- **Only dead model id: `gemini-2.0-flash-exp`** in `MODEL_TOKEN_PRICES`
  (`api-costs.ts:286`) — no code requests it. Purge (trivial).
- Perplexity `llama-3.1-sonar-large-128k-online` is LIVE but cold (chain slot 7).

## D. Cost/usage tracking — what exists, gaps, proposal

**Exists:** `meteredFetch` (provider/route/status/ms/ts rows) + `recordAiCall`
(model/tokens/costUsd); durable Supabase `api_calls` + ephemeral ring buffer;
rollup views `api_calls_daily`, `api_spend_daily`; Budget Guard with
daily/monthly hard-stops + kill flag. Surfaced on Costs tab + Budget-Guard
panel.

**Gaps (ranked):**
1. **Partial data-provider metering.** Only ~10 call sites use `meteredFetch`.
   **Apify, Alpha Vantage, FMP, Serper, ScrapingBee, FRED use plain `fetch`** →
   "Measured usage" undercounts data-API calls. LLM accounting is complete;
   data-provider accounting is not.
2. **No dollar figure for flat/data providers** (by design — only per-token can
   overspend), so the only real $ number is LLM spend.
3. **Ephemeral without Supabase** — no service key → counts reset each cold
   start.
4. **Two split budgets** — no single "total spend" view.

**Proposal (extend, don't rebuild):**
- Close gap 1: route the 6 remaining data-provider fetches through
  `meteredFetch` with a `routeTag`. Zero schema change.
- Add durable `api_usage_monthly` view (month × provider → calls, priced_usd,
  unpriced_calls).
- Add a "Monthly by provider" table to the Costs tab from that view.
- Unify the two budget cards into one (flat-fee plan + measured MTD per-use vs a
  single combined target) — data already exists, only presentation is split.
- Do NOT build token accounting/cost engine — they exist and work.

## Priority

1. **Purge Twelve Data + SerpAPI** (+ dead `gemini-2.0-flash-exp` constant) —
   low risk, immediate clarity.
2. **Close the data-provider metering gap** — makes "Measured usage"
   trustworthy; small, mechanical.
3. **Consolidate admin redundancy** — fold APIs tab into Health; unify the two
   budget cards; dedupe the 3 key-resolution surfaces.
4. Everything else is fine as-is (all tabs reachable; AI tab derives from code).
