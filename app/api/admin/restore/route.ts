import { NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth"
import JSZip from "jszip"
import fs from "fs"
import path from "path"

export async function POST(request: Request) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const zip = new JSZip()
    const contents = await zip.loadAsync(buffer)

    const projectRoot = process.cwd()

    // Extract all files from the zip
    for (const [relativePath, zipEntry] of Object.entries(contents.files)) {
      if (zipEntry.dir) continue

      // Skip sensitive files and directories
      if (relativePath.includes("node_modules") || relativePath.startsWith(".git") || relativePath.includes(".env")) {
        continue
      }

      const content = await zipEntry.async("nodebuffer")
      const fullPath = path.join(projectRoot, relativePath)

      // Create directory if it doesn't exist
      const dir = path.dirname(fullPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Write the file
      fs.writeFileSync(fullPath, content)
    }

    return NextResponse.json({
      success: true,
      message: "Restore completed successfully",
    })
  } catch (error) {
    console.error("Restore error:", error)
    return NextResponse.json({ error: "Restore failed" }, { status: 500 })
  }
}
