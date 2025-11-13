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
}

export function ApiKeysManager() {
  const [apiKeys, setApiKeys] = useState<ApiKeyStatus[]>([
    {
      name: "POLYGON_API_KEY",
      label: "Polygon.io API Key",
      description: "For real-time options and stock data",
      configured: false,
      envVarName: "POLYGON_API_KEY",
    },
    {
      name: "TWELVE_DATA_API_KEY",
      label: "TwelveData API Key",
      description: "For technical indicators and fundamentals",
      configured: false,
      envVarName: "TWELVE_DATA_API_KEY",
    },
    {
      name: "FMP_API_KEY",
      label: "Financial Modeling Prep API Key",
      description: "For financial statements and ratios",
      configured: false,
      envVarName: "FMP_API_KEY",
    },
    {
      name: "FRED_API_KEY",
      label: "FRED API Key",
      description: "For economic data (Fed Funds, CPI)",
      configured: false,
      envVarName: "FRED_API_KEY",
    },
    {
      name: "APIFY_API_TOKEN",
      label: "Apify API Token",
      description: "For web scraping and data extraction",
      configured: false,
      envVarName: "APIFY_API_TOKEN",
    },
    {
      name: "RESEND_API_KEY",
      label: "Resend API Key",
      description: "For sending email notifications",
      configured: false,
      envVarName: "RESEND_API_KEY",
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

        <div className="space-y-3">
          {apiKeys.map((apiKey) => (
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
