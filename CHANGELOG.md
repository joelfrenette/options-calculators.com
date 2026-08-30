# Changelog

Material changes to Options-Calculators.com, newest first.

**Scope.** This file starts at **2026-08-27**, the beginning of the private-club /
export / scanner-gate / admin-metering arc. The repository has 645 commits going
back before that; earlier history lives in `git log` and in `AUDIT_BACKLOG.md`,
and is deliberately not restated here — a second copy of a record that already
exists is a record that drifts.

**Convention.** Every material fix gets a self-contained entry: what changed and
*why it mattered*, readable without opening the diff. Entries are grouped by the
date the work landed on `main` (= production). There is no version number — the
site deploys continuously.

**A status word here is not a verification.** As with `AUDIT_BACKLOG.md`, an
entry records what was done, not proof that it still holds.

---

## 2026-08-30

### Changed
- **The provider chain stops being written down in five places.**
  `/api/ccpi/executive-summary` carried a private copy of the whole chain plus a
  60-line fallback loop, and it had drifted exactly the way `/api/ccpi/chat`'s
  copy did before that one was deleted (P7-9): **six providers against the
  canonical seven, with Perplexity simply absent** — so the route gave up one
  fallback earlier than every other AI route, and returned drifted provider
  names ("OpenRouter (free)", "xAI") to the client. The sharp end is a
  provenance defect, not untidiness: the admin AI tab renders
  `getProviderChain()` as "the live fallback chain, in the exact order the
  generate/stream loops try it", so the panel was describing a chain this route
  did not use. It now calls `generateWithFallback`. The copy's one real
  justification — treating an **empty completion as a failure** and falling
  through to the next provider — moved *into* `generateWithFallback`, so every
  caller gets it; previously any caller could silently receive `""`, and on this
  route that empty string would have been rendered as the executive summary.
  The empty-response row is still recorded `ok: true`, deliberately: a provider
  that returns nothing still consumed tokens and still bills.

### Removed
- **`getAIEstimate` in `/api/panic-euphoria` — 75 dead lines, four rule
  violations.** Defined, never called, and a *fifth* hand-written copy of the
  provider chain. It ended **`return 0`** on every failure path while typed
  `Promise<number>` — the strongest possible reading of a normalized −1..+1
  indicator returned as its not-found value, against the first data-integrity
  rule in `CLAUDE.md`. It also used raw `fetch` (so neither AI call reached the
  ledger or the budget guard, on a route that otherwise meters correctly),
  `getApiKey` instead of `resolveApiKey` (bypassing DISABLED_APIS and the E-5
  kill switch, with a hand-duplicated key-alias list), and `model: "grok-2"` —
  retired, and spelled differently enough from `grok-2-latest` to survive the
  slug sweep in this same release. Deleted rather than repaired, on P6-34's
  precedent: an LLM asked to guess an indicator, falling back to a constant, is
  the invented-data layer wearing a different import path.

- **Every model slug in the AI chain was 2024 vintage; five are now current.**
  The chain had rotted where nobody could see it, and the vendors' own calendars
  confirm it: **`gemini-2.0-flash` was shut down 2026-06-01**;
  **`llama-3.3-70b-versatile` was deprecated 2026-06-17 and stopped being served
  during August 2026** — the ledger's last successful Groq call is
  **2026-08-14**, which is the vendor's notice and this site's data agreeing
  independently; `grok-2-latest` predates grok-3 and grok-4, both of which xAI
  retired on 2026-05-15. Only `openrouter/free` — an auto-router, pinned to no
  version — still resolved, which is why it was the one provider still working.
  Bumped: groq → `openai/gpt-oss-120b` (Groq's own recommended replacement),
  google → `gemini-2.5-flash-lite` (Google's own migration target), openai →
  `gpt-5.4-nano`, xai → `grok-4.6`, anthropic → `claude-haiku-4-5`. Perplexity's
  slug is left alone: it sits in cold slot 7, has never been called, and there
  is therefore no evidence either way — an unverified change is not an
  improvement. **`MODEL_TOKEN_PRICES` moved in the same commit**, because a
  bumped slug against a stale price table records `cost_known: false`, which the
  budget guard counts as unaccounted spend. Display names moved too — the admin
  rendered "Groq (Llama 3.3 70B)" and "xAI (Grok 2)", and a label is a claim.
  A new assertion now **fails the suite if any chain or fetcher model has no
  price on file**, which is the tie that was missing between the two files.
  **Note this ends a $0 bill:** the chain cost nothing because it failed.

### Added
- **The admin AI tab shows whether a provider *works*, not just whether a key
  resolves.** It reported `willBeTried: p.hasKey` and painted it green, so xAI
  wore a green "KEY RESOLVED — in the chain" badge through 401 consecutive
  failures. A resolvable key and a working provider are different facts and only
  one was on screen. Each provider now carries a second, ledger-backed chip —
  `WORKING` / `INTERMITTENT` / `FAILING` / `NOT CALLED` over a trailing 7 days —
  and a failing provider shows its last failure time and dominant cause with the
  fix it implies ("the model id is retired — change the slug"). Green now means
  observed-working; a resolved key is neutral grey. **Nothing is probed**: every
  AI endpoint the app calls is a chat completion, so a liveness probe would bill
  the owner to render a status light. The numbers come from calls the app
  already made, via new Supabase view `api_provider_health` (migration `0016`,
  applied to production). `NOT CALLED` is deliberately its own state — a
  provider nobody called is neither healthy nor broken, and collapsing it either
  way is how a dead provider reads as fine. Where a failure predates cause
  logging the panel says "not recorded" rather than showing nothing. (`d571c1d`+)

### Fixed
- **A failed AI call now records *why* it failed.** It used to record `ok: false`
  and nothing else — `recordAiCall` hardcoded `status: 0` on the failure path,
  discarding the upstream status the SDK error already carried. Three of the four
  `lib/*-market-data.ts` fetchers were worse still: they caught, returned `null`,
  and never metered at all, two of them under a comment explaining the silence.
  **The cost: xAI failed 401 times out of 401 between 2026-08-08 and 2026-08-30 —
  a 100% failure rate on the first provider of all six CCPI fallback chains,
  feeding the site's default landing page — durably recorded and completely
  unreadable.** It was investigated for three weeks as a token-accounting
  question, because unpriced rows are what you see when you cannot see the cause.
  There were no tokens to record; there had never been a successful call.
  New `lib/ai-error-class.ts` classifies a thrown error into one of eight causes
  chosen to separate the *different fixes* they need — `model_not_found` (change
  the slug), `auth` (rotate the key), `rate_limit` (back off), plus
  `bad_request` / `upstream` / `timeout` / `transport` / `unknown`. `unknown`
  admits it has no rule rather than defaulting into a neighbouring class: a wrong
  class sends you to rotate a key that was fine. Migration `0015` adds
  `error_class` and `error_detail` (nullable, no backfill — rows written before
  this have no cause on file and read NULL rather than a guessed one), applied to
  production. Enforced by `scripts/check-ai-error-class.ts`, which scopes itself
  from structure rather than prose and asserts its own scope sizes. (`d571c1d`)
- **Three providers recorded no failures at all.** `anthropic`, `groq` and
  `openai` market-data fetchers now meter every failed call. Their rate-limit
  branches still keep quiet in the *console* — a log-noise decision — but no
  longer keep quiet in the accounting record. A fallback "working as intended"
  and a fallback whose every provider is dead produced the identical empty
  ledger. (`d571c1d`)
- **Provider tags are canonicalised at the single write point.** Different call
  sites had been writing `xai` vs `xAI`, `groq` vs `Groq`, `openrouter` vs
  `OpenRouter (free)` into the metering ledger, so one provider fragmented into
  several rows in every rollup — the monthly view and the budget guard's
  per-provider sums both undercounted. `canonicalProvider()` now normalises
  inside `record()` in `lib/metered-fetch.ts`, which every metered call and every
  `recordAiCall` passes through, so no call site can reintroduce the drift. A
  29-row casing backfill cleaned the existing ledger. (`29e3fbd`)
- **`recordAiCall` accepts both AI usage shapes.** It read only the v5
  `inputTokens`/`outputTokens` shape; providers returning the v4/OpenAI
  `promptTokens`/`completionTokens` shape yielded no token counts, and therefore
  a `null` cost. Unpriced calls are counted as *unaccounted*, not free — but the
  spend they represented was invisible. Both shapes are now read. (`29e3fbd`)

### Added
- **Monthly usage by provider.** New Supabase view `api_usage_monthly`
  (month × provider → calls, priced USD, unpriced calls; migration `0014`,
  applied to production) and a table on the admin Costs tab that reads it.
  Measured usage had been visible only as a daily rollup, which is the wrong
  window for a monthly bill. (`3fb982b`)

## 2026-08-29

### Changed
- **The APIs tab folds into Health.** Its vendor-endpoint probe was a strict
  subset of what Health already does — Health probes every route, lists key
  resolution, and shows the gates — so the tab cost a click and taught nothing.
  Removed rather than kept "just in case". (`555ac49`)
- **Admin key surfaces dedupe onto the Keys tab.** Key-resolution status had
  been rendered in three places besides the tab that actually *manages* keys.
  The APIs and AI tabs now point at the canonical Keys tab. (`9b912bf`)
- **The two budget surfaces are colocated on Costs.** The flat-fee target lived
  on Costs and the per-use spend-vs-hard-stops Budget Guard lived on Health, so
  no single screen answered "what am I spending". They now sit together.
  (`849e8bf`)

### Fixed
- **The metering gap is closed.** Only about ten call sites used `meteredFetch`;
  **Apify, Alpha Vantage, FMP, Serper, ScrapingBee and FRED used plain `fetch`**,
  so the admin's "Measured usage" silently undercounted data-API calls. All six
  now route through `meteredFetch` with a `routeTag`. No schema change.
  (`67d85e6`)
- **Scanners block when the market is closed, and say so.** They had returned an
  empty list, which is indistinguishable from "no setups today" — a false
  negative that reads as a working scan. `lib/market-hours.ts` `getMarketStatus()`
  now gates them behind a loud banner with a live countdown to the next open
  (`2f937c8`), extended site-wide as an info variant on the live dashboards
  (`332b519`).
- **Step 4 entry defaults were too tight for pullback entries.** The 50-SMA,
  golden-cross and laggard filters are off by default and RSI moves to 65, so a
  cash-secured-put scan can actually admit the pullback names it exists to find.
  (`6d0cade`)

### Removed
- **Two dead providers purged: Twelve Data and SerpAPI.** Both were registered in
  `lib/api-keys.ts`, probed by the APIs tab and listed in the cost table, with
  **zero live call sites** — Twelve Data's QQQ-technicals job had moved to
  Polygon, SerpAPI's Google-Trends job to Serper. A key that appears in the admin
  but is never used is a standing invitation to keep paying for it. The dead
  `gemini-2.0-flash-exp` price constant went with them. (`1504dcc`)

### Documentation
- `ADMIN_AUDIT_2026-08-29.md` — read-only audit of the admin section, provider
  and key registry, AI models, and cost/usage tracking. Its headline correction:
  cost and token tracking already existed, so the work was to extend it, not to
  build it. (`83cfb0c`)

## 2026-08-28

### Fixed
- **The relaxed pass GRADES the down-year gate, so Step 5 stops emptying.** On a
  down day the relaxed pass excluded nearly every candidate and Step 5 returned
  nothing — the scanner looked broken precisely when it was most wanted. Entry
  exclusions are now tiered: **Stage 4 and a big up-day are always hard-excluded
  and never relax**; a down year is *graded*, admitting large, mildly-down names
  while deep declines, small caps and Stage 4 stay out. (`baaacf6`, `97d2afd`)
- **Relaxed down-year thresholds tuned** — deep decline −20% → −25%, market-cap
  floor $20B → $10B. (`d0e9d2c`)
- **Session cookie survives a cross-site embed.** `SameSite=None` in production
  plus an Origin CSRF gate, so an embedded session is not silently signed out.
  (`dae75c5`, PR #31)

### Added
- **The relaxed thresholds became live sliders** in the Step 4 card, so the
  judgment call is the operator's rather than a constant in a file. (`2e38a4b`)

## 2026-08-27

### Added
- **The site becomes a private club behind a calculator.** Members-only access
  with a code-pad door. (`8781047`)
- **Members get their own Users tab in the admin**, and members can reset their
  password by email — closing the member half of P4-2. (`5704feb`, `5972a94`)
- **Every results table gets an Export menu: PDF, Excel, or Email.** Any report
  can be emailed as a formatted message with Excel and PDF attachments; the
  Earnings & Economic Calendar gets its own Email-calendar button. Email cards
  feature each page's key metrics, and the CSP email's top-3 cards carry the
  actual decision — strike, yield, DTE, cash needed. (`43e3df5`, `80f7cf5`,
  `cbcda6d`, `64dee94`, `f1a992c`, `a1fc0a6`, `20d46e3`)
- **The header knows who you are** — Admin button for the owner, Sign out for
  everyone — and the mobile menu carries the session controls too. (`f99b05d`,
  `faeb3eb`)

### Changed
- **The admin area joins the site's own design**, the Health tab reads in the
  owner's order under a full-width menu, and the dashboard header earns its
  height. (`7bdfd42`, `ed7b50e`, `5758f82`)
- **CSP report sorting is decision-first**: ordered by expiry, then ranked by
  **yield %** rather than raw premium within each expiry — premium alone ranks
  expensive stock ahead of good return. The Excel export gains column filters,
  and every COPY-page report gets a considered best-first default sort.
  (`136aa9e`, `de7b6e5`, `e15ccc1`, `8129fcb`)

### Fixed
- **pdfkit's fonts are bundled so the PDF builds on Vercel**, and email now
  survives a PDF miss rather than failing the whole send. (`d0fa7eb`)
- **The relaxed pass is Step 5**, and it relaxes the entry exclusions too — the
  step numbering had not matched what the scanner did. (`da65bce`)
- **The code pad echoes every press**, including leading zeros. A door that
  silently drops a keystroke cannot be operated. (`2f6fd1e`)
- **Admins entering through the door land in the admin area.** (`24e1e9d`)
- `Step 3 3` double-3 typo in the no-technical-results notice. (`c016368`)

### Removed
- **The ads feature retires completely**; the admin nav spans eight tabs.
  (`3d97e32`)
