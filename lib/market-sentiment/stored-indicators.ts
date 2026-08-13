/**
 * Indicators /api/market-sentiment computes from this site's OWN stored data,
 * and the list of fields it deliberately does not track.
 *
 * Split out of `app/api/market-sentiment/route.ts` (P6-13), which was 1,140
 * lines. Nothing here changed in the move.
 */
import { sma } from "@/lib/indicators"
import { getStoredCloses } from "@/lib/market-closes"
import { getSeriesHistory } from "@/lib/market-series"


/**
 * Raw indicators computed from OUR OWN stored data — P6-22.
 *
 * These are the three fields that correctly read "NO DATA" after P6-18 removed
 * their invented constants: spot VIX (was a literal 0), its 50-day average
 * (was `vixVs50DayMA * 50 + vix`, a linear combination of a ratio and a spot
 * level printed to two decimals) and SPY momentum (was divided by a hardcoded
 * 125 regardless of how many closes came back).
 *
 * The E-7c snapshot now stores both inputs, so they can be measured instead of
 * guessed: VIXCLS from FRED and SPY closes from Polygon.
 *
 * THESE ARE NOT CNN COMPONENT SCORES and are deliberately not wired into the
 * seven-component list. They are raw measured quantities on their own scales —
 * a VIX level, a percentage versus a moving average. Turning them into 0-100
 * component scores would mean inventing a transform CNN has never published
 * and rendering the result alongside CNN's own figures as if it were one.
 *
 * putCallRatio is absent from THIS route on purpose. **The reason stated here
 * used to be false, and P7-57 corrected it**: it read "nothing in the codebase
 * sources one", and something does — `scrapePutCallRatio` in `/api/ccpi` fetches
 * the CBOE reading through ScrapingBee, and only a genuine reading is permitted
 * to claim `live` (P6-72). So this tab renders "—" for a figure the site
 * actually goes and gets.
 *
 * It stays null here DELIBERATELY, and the reason is worth stating precisely
 * because the correction above overshot. `scrapePutCallRatio` tries **Grok
 * first** and returns `ai-estimate` whenever the model gives a plausible number;
 * the CBOE scrape is the fallback, not the primary. So `/api/ccpi` usually holds
 * a language model's recollection of the ratio — correctly tiered, and barred
 * from scoring since P6-72 — and only sometimes a measured reading.
 *
 * Piping that into a second tab would mostly spread an AI estimate, which is
 * what P6-11 retired a whole route for. The dash stays.
 *
 * Named in `notTracked` so the null is not read as a bug — but "not tracked by
 * this route" and "unobtainable" are different claims, and the old wording made
 * the second one.
 *
 * The general shape is P7-55's: two routes making contradictory statements about
 * the same quantity, each internally consistent, neither reading the other.
 */
export async function fetchStoredRawIndicators(): Promise<{
  vix: number | null
  vix50DayMA: number | null
  stockPriceMomentum: number | null
}> {
  const [vixRows, spyRows] = await Promise.all([
    getSeriesHistory("fred:VIXCLS", 80),
    getStoredCloses("SPY", 200, 125),
  ])

  let vix: number | null = null
  let vix50DayMA: number | null = null
  if (vixRows && vixRows.length > 0) {
    vix = vixRows[0].value
    // Both stores return newest-first; sma() takes oldest-first.
    const ma = sma([...vixRows].reverse().map((r) => r.value), 50)
    vix50DayMA = ma !== null && ma > 0 ? Number(ma.toFixed(2)) : null
  }

  let stockPriceMomentum: number | null = null
  if (spyRows && spyRows.length >= 125) {
    const closes = [...spyRows].reverse().map((r) => r.close)
    // sma() returns null on short history rather than a stand-in, so a thin
    // store yields null momentum instead of a percentage against a fake mean.
    const ma125 = sma(closes, 125)
    if (ma125 !== null && ma125 > 0) {
      stockPriceMomentum = Number((((closes[closes.length - 1] - ma125) / ma125) * 100).toFixed(2))
    }
  }

  return { vix, vix50DayMA, stockPriceMomentum }
}

/**
 * Indicators this route does not carry — named so a null is not read as a bug.
 *
 * NOT "indicators with no source at all", which is what this said before P7-57.
 * `putCallRatio` has a source; it is simply not wired here. See the header.
 */
export const NOT_TRACKED = ["putCallRatio"]
