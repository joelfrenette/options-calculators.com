import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: "FMP API endpoints require premium subscription. Using Yahoo Finance data only." },
    { status: 410 },
  )
}
