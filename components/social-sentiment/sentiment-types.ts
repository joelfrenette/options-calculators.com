// The four scores are null whenever no source in that band returned a reading.
// They are never 50 — on a 0-100 sentiment scale 50 is a real neutral market.
export interface SentimentData {
  global_social_sentiment: number | null
  macro_sentiment: number | null
  social_sentiment: number | null
  headline_market_mood: number | null
  api_version?: string
  timestamp?: string
  sources_available?: number
  sources_total?: number
  data_quality?: string
  indicators?: Array<{
    name: string
    score: number | null
    weight: number
    status: string
    source: string
    description: string
  }>
  sources?: Array<{
    name: string
    score: number
    weight: number
    source: string
  }>
  executive_summary?: string
  weekly_outlook?: string
  recommended_strategies?: string[]
  per_symbol?: Array<{
    symbol: string
    name: string
    sentiment: number | null
    direction?: string
    bullish?: number
    bearish?: number
    source?: string
  }>
}

export interface SentimentIndicator {
  name: string
  score: number
  status: string
  description: string
  isLive: boolean
}
