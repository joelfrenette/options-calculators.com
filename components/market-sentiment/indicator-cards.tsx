/**
 * The seven Fear & Greed indicator cards: copy, band descriptions and which
 * stored series each one charts.
 *
 * Split out of `components/market-sentiment.tsx` (P6-13). ONE mechanical
 * change: the array read the component's `components` local for each score,
 * and now takes it as an argument. No score is computed here — every value
 * arrives already resolved, null included.
 */
import {
  ActivityIcon,
  BarChartIcon,
  DollarSignIcon,
  ShieldIcon,
  TargetIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "./icons"
import { getIndicatorSentiment } from "./indicator-meta"

export const buildIndicatorCards = (components: { name: string; description: string; value: number | null }[]) => (
  [
  {
    name: "MARKET MOMENTUM",
    description: "S&P 500 vs 125-day moving average",
    score: components[0].value,
    sentiment: getIndicatorSentiment(components[0].value),
    icon: <ActivityIcon />,
    tooltipKey: "momentum",
  },
  {
    name: "STOCK PRICE STRENGTH",
    description: "Next over 52-week highs and lows on the NYSE",
    score: components[1].value,
    sentiment: getIndicatorSentiment(components[1].value),
    icon: <TrendingUpIcon />,
    tooltipKey: "strength",
  },
  {
    name: "STOCK PRICE BREADTH",
    description: "McClellan Volume Summation Index",
    score: components[2].value,
    sentiment: getIndicatorSentiment(components[2].value),
    icon: <BarChartIcon />,
    tooltipKey: "stockBreadth",
  },
  {
    name: "PUT AND CALL OPTIONS",
    description: "5-day average put/call ratio",
    score: components[3].value,
    sentiment: getIndicatorSentiment(components[3].value),
    icon: <TargetIcon />,
    tooltipKey: "putCall",
  },
  {
    name: "MARKET VOLATILITY",
    description: "VIX vs 50-day moving average",
    score: components[4].value,
    sentiment: getIndicatorSentiment(components[4].value),
    icon: <ActivityIcon />,
    tooltipKey: "vix",
  },
  {
    name: "SAFE HAVEN DEMAND",
    description: "Difference in 20-day stock and bond returns",
    score: components[5].value,
    sentiment: getIndicatorSentiment(components[5].value),
    icon: <ShieldIcon />,
    tooltipKey: "safeHaven",
  },
  {
    name: "JUNK BOND DEMAND",
    description: "Yield spread: Investment grade bonds vs junk bonds",
    score: components[6].value,
    sentiment: getIndicatorSentiment(components[6].value),
    icon: <DollarSignIcon />,
    tooltipKey: "junkBond",
  },
  ]
)
