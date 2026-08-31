import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/auth"

export async function GET() {
  try {
    const authenticated = await isAdmin()
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // File system backups don't work in serverless environments
    return NextResponse.json({
      message: "Backups on Vercel are handled via Git integration",
      instructions: [
        "Your code is automatically backed up in your GitHub repository",
        "To create a manual backup: git commit && git push",
        "To restore: Deploy a previous commit from Vercel dashboard",
        "Database backups should be handled by your database provider (Supabase, Neon, etc.)",
      ],
      vercelDocs: "https://vercel.com/docs/deployments/overview",
    })
  } catch (error) {
    console.error("Backup error:", error)
    return NextResponse.json({ error: "Backup check failed" }, { status: 500 })
  }
}
