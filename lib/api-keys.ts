// Secure API key encryption and storage utilities
// import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-32-char-encryption-key!" // 32 chars

export interface ApiKeyConfig {
  POLYGON_API_KEY?: string
  TWELVE_DATA_API_KEY?: string
  TWELVEDATA_API_KEY?: string
  FMP_API_KEY?: string
  FRED_API_KEY?: string
  APIFY_API_TOKEN?: string
  RESEND_API_KEY?: string
}

// Removed crypto and fs dependencies that don't work in Edge runtime

// Simple getter that only reads from environment variables
export function getApiKey(keyName: keyof ApiKeyConfig): string {
  const envValue = process.env[keyName]
  if (!envValue) {
    console.warn(`[API Keys] ${keyName} not found in environment variables`)
    return ""
  }
  return envValue
}

// For admin UI - check which keys are configured
export function getConfiguredKeys(): Record<keyof ApiKeyConfig, boolean> {
  return {
    POLYGON_API_KEY: !!process.env.POLYGON_API_KEY,
    TWELVE_DATA_API_KEY: !!process.env.TWELVE_DATA_API_KEY,
    TWELVEDATA_API_KEY: !!process.env.TWELVEDATA_API_KEY,
    FMP_API_KEY: !!process.env.FMP_API_KEY,
    FRED_API_KEY: !!process.env.FRED_API_KEY,
    APIFY_API_TOKEN: !!process.env.APIFY_API_TOKEN,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
  }
}
