import { NextResponse } from "next/server"
import { Resend } from "resend"
import { getApiKey } from "@/lib/api-keys"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (email !== "joelfrenette@gmail.com") {
      return NextResponse.json({ error: "Email not found" }, { status: 404 })
    }

    const RESEND_API_KEY = getApiKey("RESEND_API_KEY")

    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 })
    }

    const resend = new Resend(RESEND_API_KEY)

    const resetToken = Math.random().toString(36).substring(2, 15)
    const resetUrl = `https://options-calculators.com/reset-password?token=${resetToken}`

    await resend.emails.send({
      from: "Options Calculator <noreply@options-calculators.com>",
      to: email,
      subject: "Password Reset Request",
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    })

    return NextResponse.json({ success: true, message: "Reset email sent" })
  } catch (error) {
    console.error("Password reset error:", error)
    return NextResponse.json({ error: "Failed to send reset email" }, { status: 500 })
  }
}
