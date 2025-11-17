import { NextResponse } from "next/server"

// This API returns historical CCPI data for charting
// In production, this would query a database
// For now, we generate realistic mock historical data

export async function GET() {
  try {
    // TODO: Implement real historical CCPI data storage in database
    // For now, returning empty array with notice to users
    
    return NextResponse.json({
      history: [],
      notice: "Historical CCPI data requires database implementation. Currently showing real-time data only.",
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("CCPI history API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch CCPI history" },
      { status: 500 }
    )
  }
}

// function generateHistoricalData() {
//   const data = []
//   const now = new Date()
  
//   // Generate 24 months of weekly data
//   for (let i = 104; i >= 0; i--) {
//     const date = new Date(now)
//     date.setDate(date.getDate() - (i * 7))
    
//     // Simulate various market regimes
//     let ccpi: number
//     let certainty: number
    
//     if (i > 90) {
//       // Early period: low risk
//       ccpi = 15 + Math.random() * 15
//       certainty = 60 + Math.random() * 20
//     } else if (i > 70) {
//       // Rising risk period
//       ccpi = 30 + Math.random() * 25
//       certainty = 65 + Math.random() * 20
//     } else if (i > 50) {
//       // Peak euphoria
//       ccpi = 50 + Math.random() * 20
//       certainty = 70 + Math.random() * 15
//     } else if (i > 30) {
//       // Correction warning
//       ccpi = 60 + Math.random() * 20
//       certainty = 75 + Math.random() * 15
//     } else if (i > 20) {
//       // Sharp selloff
//       ccpi = 75 + Math.random() * 15
//       certainty = 80 + Math.random() * 10
//     } else {
//       // Recovery period
//       ccpi = 40 + Math.random() * 20
//       certainty = 60 + Math.random() * 20
//     }
    
//     data.push({
//       date: date.toISOString().split('T')[0],
//       ccpi: Math.round(ccpi),
//       certainty: Math.round(certainty)
//     })
//   }
  
//   return data
// }
