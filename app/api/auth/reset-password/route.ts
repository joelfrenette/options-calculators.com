import { NextResponse } from "next/server"

/**
 * Admin password recovery — AUDIT_BACKLOG P4-2.
 *
 * WHAT THIS USED TO DO, AND WHY IT WAS REMOVED. It generated a token with
 * `Math.random()`, stored it nowhere, emailed a link to `/reset-password` — a
 * page that does not exist in `app/` and 404s — and answered
 * `{ success: true, message: "Reset email sent" }`. The login UI then told the
 * owner "Password reset email sent! Check your inbox."
 *
 * None of it could ever have worked. The admin credential is the ADMIN_PASSWORD
 * / ADMIN_PASSWORD_HASH environment variable, and no web request can change an
 * environment variable. A reset flow is not merely unimplemented here; it is
 * impossible by construction. The owner discovered this the hard way, locked
 * out, following a button that lied.
 *
 * So this endpoint no longer pretends. It returns 501 with the recovery
 * procedure that actually works. That is the honest answer for an env-var
 * credential, and it matches the house rule that the UI must never present
 * something as done when it has not happened.
 *
 * IF SELF-SERVICE RESET IS WANTED LATER it requires moving admin auth off the
 * env var into a real store (Supabase is connected) with a hashed credential,
 * a stored single-use token with an expiry, and a real /reset-password page.
 * That is a feature, not a bug fix — tracked in the backlog.
 */

export async function POST() {
  // 501 Not Implemented, not a 200 with an error body: the house rule is that
  // error responses use real HTTP error statuses. Deliberately says nothing
  // about whether any particular address is the admin — the old version
  // answered 404 "Email not found" for a non-match, which made it an oracle
  // for the admin's email address.
  return NextResponse.json(
    {
      error: "Self-service password reset is not available for the admin account.",
      recovery: [
        "Open Vercel → your project → Settings → Environment Variables.",
        "Update ADMIN_PASSWORD_HASH (preferred) or ADMIN_PASSWORD.",
        "Generate a hash with `node scripts/hash-admin-password.ts`.",
        "Redeploy — environment variables only take effect on a new build.",
        "Sign in at /login with the new password.",
      ],
    },
    { status: 501 },
  )
}
