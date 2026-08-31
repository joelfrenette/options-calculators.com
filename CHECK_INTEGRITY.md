# Check Integrity — findings about the checks themselves

`AUDIT_BACKLOG.md` records findings about the code. Nothing recorded findings
about the **suite that guards the code**, and on 2026-08-30 a single session
found six defects in it. This file is that record.

Every one of the six was **passing**. None had ever failed. A check that has
stopped covering something reports exactly what a check that covers everything
reports, and this project already knew that — `CLAUDE.md` says *"a check that
stops COVERING is as invisible as one that stops running: the PASS count is
identical either way."* The rule was written. What was missing was any way to
notice when it was violated.

---

## The taxonomy

Two distinctions explain all six, and both are about **shape**, not content.

### 1. Drift vs. omission

|  | What it is | Caught by a size assertion? |
|---|---|---|
| **Drift** | A scope that was right and got smaller | **Yes** — the count moves |
| **Omission** | A scope that was never right, or that a refactor left behind | **No** |

A size assertion fails when a list **shrinks**. An omission does not shrink
anything: a module split creates new files that should have been *added*, and no
count of the old list can notice an absence. A filter written with the wrong file
extension never covered that extension, so its count was always "correct".

**Size assertions catch drift, not omission.** Three of the six were omissions,
and their size assertions were passing throughout.

The remedy is to assert the **property** rather than the size — a rule about what
the scope MUST contain. `scripts/check-orphan-routes.ts` now carries one (search
for `THE OMISSION GUARD`): *every file that enumerates route paths in bulk is
either declared infrastructure or is a real caller.* It failed on its first run
and found a file a by-hand sweep had missed.

### 2. Assertion-shaped vs. filter-shaped

|  | Form | When its pattern matches nothing |
|---|---|---|
| **Assertion-shaped** | `check(name, /pattern/.test(src))` | **FAILS loudly** — safe |
| **Filter-shaped** | `for (const m of src.matchAll(...))` | **Silence** — an empty result set is indistinguishable from a clean sweep |

Most name-based patterns in `scripts/` are assertion-shaped and need nothing.
Only filter-shaped uses need a floor on the number of matches. This distinction
is why "add floors everywhere" is the wrong instinct — it only shows up by
reading each use.

---

## The six

| # | Check | Class | What it stopped covering |
|---|---|---|---|
| 1 | `check-dead-exports` (referrer scan) | Omission | Any lib export used only from a `lib/*.tsx`. Fired a **false positive**, which is the benign direction — it failed loudly. |
| 2 | `check-dead-exports` (`LIB_FILES`) | Omission | Exports **defined** in a `lib/*.tsx` were never examined at all. Silent. Hid five dead exports, one of which returned a **hardcoded Buffett Indicator of 180** dressed as a measurement. |
| 3 | Five more checks, same `.tsx` filter | Omission | Nothing, as it happens. `lib/` holds only two `.tsx` files and neither violated those rules. Recorded because *a blind spot that happens to be empty is still a blind spot* — and because the honest result differs from #2's and should not be reported in the same tone. |
| 4 | `check-orphan-routes` (`INFRASTRUCTURE`) | Omission | P7-82 split `lib/remediation.ts`; the exclusion list still named the pre-split file. The split modules' 17 route-path literals counted as **feature callers**. Orphans read as 10 when they were 14; **17 of 65 routes** could have lost their last caller and still read as referenced. |
| 5 | `check-provenance` (AI call-site rule) | Filter, emptied by rename | Two of three pattern alternatives named `Grok` helpers **deleted in the same session**. `lib/scraping-bee.tsx`'s AI calls left coverage entirely. The comment above the rule names the exact case then uncovered. **Self-inflicted, three commits earlier.** |
| 6 | `check-provenance` (JSON-response rule) | Filter, unfloored | Not yet broken. Guards the HTTP-200-with-an-error-body house rule — **already violated nine times** (P6-56), three with a comment explaining the downgrade. One helper refactor from silence. |

---

## What was changed

- **Scope filters corrected** in seven checks (`.tsx` in `lib/`).
- **`INFRASTRUCTURE` completed** in `check-orphan-routes`, 3 → 6 files.
- **An omission guard added** — asserts a property, not a count.
- **Two call-site floors added**: AI call sites (31, floor 10) and JSON responses
  (242 across 75 files, floor 100).
- **Five dead exports deleted**, one un-exported, decided individually per P7-9.

## What was NOT changed, and why

`check-orphan-routes` reported four routes as "now called". They are not called.
Rather than trust the NOTE and delete four `KNOWN_ORPHANS` entries — which would
have **reduced coverage on a misunderstanding** — the contradiction was chased to
its cause (#4 above). The entries were right all along; the detector was blind.

That is the general rule this session kept re-learning: **when a check and your
reading of the code disagree, find out which is wrong before changing either.**
Three times the baseline looked stale and the check was broken instead.

---

## Two lessons worth carrying

**A check cannot be trusted until it has failed.** Every fix here was verified by
watching the check fail first — the omission guard on its first run, the six
scope assertions during the OpenAI and xAI removals. `check-provenance`'s own
comments record the same discipline: a rule was found wrong by an injection test
that *failed to fail*.

**A rename is a scope change.** Deleting `lib/grok-market-data.ts` silently
disabled a rule that named it. Nothing in the suite connected the two, and the
person who made both changes was hunting this exact defect at the time.
