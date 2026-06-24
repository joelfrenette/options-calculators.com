"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Key, CheckCircle2, XCircle, ExternalLink } from "lucide-react"

interface ApiKeyStatus {
  name: string
  label: string
  description: string
  configured: boolean
  envVarName: string
  category: "Market & Economic Data" | "Scraping & Search" | "Email" | "AI / LLM Providers"
  required?: boolean
}

export function ApiKeysManager() {
  const [apiKeys, setApiKeys] = useState<ApiKeyStatus[]>([
    // Market & economic data
    {
      name: "POLYGON_API_KEY",
      label: "Polygon.io API Key",
      description: "Real-time options chains, stock quotes, Greeks",
      configured: false,
      envVarName: "POLYGON_API_KEY",
      category: "Market & Economic Data",
      required: true,
    },
    {
      name: "FRED_API_KEY",
      label: "FRED API Key",
      description: "Economic data (Fed Funds, CPI, yield curve, jobs)",
      configured: false,
      envVarName: "FRED_API_KEY",
      category: "Market & Economic Data",
      required: true,
    },
    {
      name: "TWELVE_DATA_API_KEY",
      label: "TwelveData API Key",
      description: "Technical indicators and fundamentals (accepts TWELVEDATA_API_KEY)",
      configured: false,
      envVarName: "TWELVE_DATA_API_KEY",
      category: "Market & Economic Data",
    },
    {
      name: "FMP_API_KEY",
      label: "Financial Modeling Prep API Key",
      description: "Financial statements and valuation ratios",
      configured: false,
      envVarName: "FMP_API_KEY",
      category: "Market & Economic Data",
    },
    {
      name: "ALPHA_VANTAGE_API_KEY",
      label: "Alpha Vantage API Key",
      description: "Stock data & technical indicators (VIX, VXN, ATR, SMA)",
      configured: false,
      envVarName: "ALPHA_VANTAGE_API_KEY",
      category: "Market & Economic Data",
    },
    {
      name: "FINNHUB_API_KEY",
      label: "Finnhub API Key",
      description: "Earnings, insider transactions, news sentiment",
      configured: false,
      envVarName: "FINNHUB_API_KEY",
      category: "Market & Economic Data",
    },
    {
      name: "APIFY_API_TOKEN",
      label: "Apify API Token",
      description: "Yahoo Finance scraping (accepts APIFY_API_KEY)",
      configured: false,
      envVarName: "APIFY_API_TOKEN",
      category: "Market & Economic Data",
    },
    // Scraping & search
    {
      name: "SCRAPINGBEE_API_KEY",
      label: "ScrapingBee API Key",
      description: "Web scraping for social/market sentiment (Reddit, CNN)",
      configured: false,
      envVarName: "SCRAPINGBEE_API_KEY",
      category: "Scraping & Search",
    },
    {
      name: "SERPER_API_KEY",
      label: "Serper API Key",
      description: "Google Search results for sentiment and stock news",
      configured: false,
      envVarName: "SERPER_API_KEY",
      category: "Scraping & Search",
    },
    {
      name: "SERPAPI_KEY",
      label: "SerpAPI Key",
      description: "Google Trends (fear/greed search volume) — distinct from Serper",
      configured: false,
      envVarName: "SERPAPI_KEY",
      category: "Scraping & Search",
    },
    // Email
    {
      name: "RESEND_API_KEY",
      label: "Resend API Key",
      description: "Transactional email (password reset)",
      configured: false,
      envVarName: "RESEND_API_KEY",
      category: "Email",
    },
    // AI / LLM providers (fallback chain)
    {
      name: "OPENAI_API_KEY",
      label: "OpenAI API Key",
      description: "Primary AI fallback (sentiment, CCPI summaries)",
      configured: false,
      envVarName: "OPENAI_API_KEY",
      category: "AI / LLM Providers",
    },
    {
      name: "ANTHROPIC_API_KEY",
      label: "Anthropic Claude API Key",
      description: "Secondary AI fallback, market data validation",
      configured: false,
      envVarName: "ANTHROPIC_API_KEY",
      category: "AI / LLM Providers",
    },
    {
      name: "GROQ_API_KEY",
      label: "Groq API Key",
      description: "Fast AI inference fallback",
      configured: false,
      envVarName: "GROQ_API_KEY",
      category: "AI / LLM Providers",
    },
    {
      name: "XAI_API_KEY",
      label: "xAI Grok API Key",
      description: "Real-time data extraction (accepts GROK_XAI_API_KEY)",
      configured: false,
      envVarName: "XAI_API_KEY",
      category: "AI / LLM Providers",
    },
    {
      name: "GOOGLE_AI_API_KEY",
      label: "Google Gemini API Key",
      description: "AI fallback (accepts GOOGLE_GENERATIVE_AI_API_KEY)",
      configured: false,
      envVarName: "GOOGLE_AI_API_KEY",
      category: "AI / LLM Providers",
    },
    {
      name: "OPENROUTER_API_KEY",
      label: "OpenRouter API Key",
      description: "Aggregator AI fallback",
      configured: false,
      envVarName: "OPENROUTER_API_KEY",
      category: "AI / LLM Providers",
    },
    {
      name: "PERPLEXITY_API_KEY",
      label: "Perplexity API Key",
      description: "Search-augmented AI fallback",
      configured: false,
      envVarName: "PERPLEXITY_API_KEY",
      category: "AI / LLM Providers",
    },
  ])

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkConfiguredKeys()
  }, [])

  async function checkConfiguredKeys() {
    try {
      const response = await fetch("/api/admin/api-keys")
      const data = await response.json()

      if (data.keys) {
        setApiKeys((prev) =>
          prev.map((key) => ({
            ...key,
            configured: data.keys[key.name] || false,
          })),
        )
      }
    } catch (error) {
      console.error("Failed to check API keys:", error)
    } finally {
      setLoading(false)
    }
  }

  const configuredCount = apiKeys.filter((k) => k.configured).length
  const totalCount = apiKeys.length

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          <CardTitle>API Keys Configuration</CardTitle>
        </div>
        <CardDescription>
          {configuredCount} of {totalCount} API keys configured. Manage via Vercel Environment Variables.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription className="space-y-2">
            <p className="font-semibold">How to configure API keys:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
              <li>
                Go to your{" "}
                <a
                  href="https://vercel.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Vercel Dashboard
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Select your project → Settings → Environment Variables</li>
              <li>Add each API key with the exact variable names shown below</li>
              <li>Redeploy your application for changes to take effect</li>
            </ol>
          </AlertDescription>
        </Alert>

        {Array.from(new Set(apiKeys.map((k) => k.category))).map((category) => (
          <div key={category} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 border-b pb-1">
              {category}{" "}
              <span className="font-normal text-muted-foreground">
                ({apiKeys.filter((k) => k.category === category && k.configured).length}/
                {apiKeys.filter((k) => k.category === category).length})
              </span>
            </h3>
            {apiKeys
              .filter((apiKey) => apiKey.category === category)
              .map((apiKey) => (
                <div
                  key={apiKey.name}
                  className={`p-4 border rounded-lg ${
                    apiKey.configured ? "border-green-200 bg-green-50/50" : "border-slate-200 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{apiKey.label}</span>
                        {apiKey.required && (
                          <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">
                            Required
                          </span>
                        )}
                        {apiKey.configured ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{apiKey.description}</p>
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">{apiKey.envVarName}</code>
                    </div>
                    <div className="text-xs font-medium">
                      {apiKey.configured ? (
                        <span className="text-green-600">Configured</span>
                      ) : (
                        <span className="text-slate-400">Not Set</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ))}

        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded">
          <p className="font-semibold">Security Notes:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>API keys are stored securely in Vercel's encrypted environment variable system</li>
            <li>Keys are never exposed in client-side code or logs</li>
            <li>Only server-side API routes can access these values</li>
            <li>Changes require redeployment to take effect</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
