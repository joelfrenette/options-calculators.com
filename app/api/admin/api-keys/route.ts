import { NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { getConfiguredKeys } from "@/lib/api-keys"

export async function GET(request: Request) {
  const authResult = await verifyAuth(request)

  if (!authResult.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const configuredKeys = getConfiguredKeys()

    return NextResponse.json({ keys: configuredKeys })
  } catch (error) {
    console.error("Error checking API keys:", error)
    return NextResponse.json({ error: "Failed to check API keys" }, { status: 500 })
  }
}

// API keys must be set via Vercel environment variables
