import { NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth"
import fs from "fs"
import path from "path"

const EXCLUDED_DIRS = ["node_modules", ".next", ".git", ".vercel", "dist", "build", "coverage"]

const EXCLUDED_FILES = [".env.local", ".env.production", ".DS_Store", "*.log", "npm-debug.log*"]

async function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dirPath)

  files.forEach((file) => {
    if (EXCLUDED_DIRS.includes(file) || file.startsWith(".")) {
      return
    }

    const filePath = path.join(dirPath, file)

    if (
      EXCLUDED_FILES.some((pattern) => {
        if (pattern.includes("*")) {
          const regex = new RegExp(pattern.replace("*", ".*"))
          return regex.test(file)
        }
        return file === pattern
      })
    ) {
      return
    }

    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles)
    } else {
      arrayOfFiles.push(filePath)
    }
  })

  return arrayOfFiles
}

export async function GET() {
  try {
    const authenticated = await isAuthenticated()
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
