/**
 * Generate an ADMIN_PASSWORD_HASH value for Vercel (AUDIT_BACKLOG P4-3).
 *
 * Run:  node scripts/hash-admin-password.ts
 *
 * Prompts for the password with echo disabled, so it does not end up in your
 * shell history, your terminal scrollback, or a screen recording. Prints only
 * the hash — never the password.
 *
 * Then: Vercel → project → Settings → Environment Variables → add
 * ADMIN_PASSWORD_HASH (mark it Sensitive) for Preview and Production, redeploy,
 * confirm you can still log in, and only then delete ADMIN_PASSWORD.
 *
 * Keep ADMIN_PASSWORD until the hash is confirmed working. lib/auth.ts prefers
 * the hash and falls back to the plaintext, so having both set is safe — that
 * overlap is what makes this a migration rather than a lockout.
 */

import crypto from "node:crypto"
import readline from "node:readline"

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })

    // Suppress echo: swallow the output the readline interface would write for
    // each keypress, so the password never appears on screen.
    const iface = rl as unknown as { output: NodeJS.WriteStream; _writeToOutput: (s: string) => void }
    const originalWrite = iface._writeToOutput.bind(rl)
    iface._writeToOutput = (stringToWrite: string) => {
      if (stringToWrite.includes(question)) originalWrite(stringToWrite)
    }

    rl.question(question, (answer) => {
      iface._writeToOutput = originalWrite
      rl.output.write("\n")
      rl.close()
      resolve(answer)
    })
  })
}

const KEY_LENGTH = 64

async function main() {
  const password = await prompt("New admin password: ")
  if (!password) {
    console.error("No password entered. Nothing generated.")
    process.exit(1)
  }
  if (password.length < 12) {
    // A warning, not a hard stop — it is the owner's call, but an admin login
    // with no rate limit history deserves a long password.
    console.warn(`\nWARNING: that password is ${password.length} characters. 16+ is strongly recommended.`)
  }

  const confirm = await prompt("Confirm password: ")
  if (confirm !== password) {
    console.error("Passwords did not match. Nothing generated.")
    process.exit(1)
  }

  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH)
  const value = `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`

  console.log("\nADMIN_PASSWORD_HASH")
  console.log(value)
  console.log(
    "\nNext:\n" +
      "  1. Vercel → Settings → Environment Variables → add ADMIN_PASSWORD_HASH (mark Sensitive)\n" +
      "     for BOTH Preview and Production.\n" +
      "  2. Redeploy. Env vars only take effect on a new build.\n" +
      "  3. Confirm you can log in to /admin.\n" +
      "  4. Only then delete the plaintext ADMIN_PASSWORD.\n",
  )
}

main().catch((err) => {
  console.error("Failed to generate hash:", err instanceof Error ? err.message : String(err))
  process.exit(1)
})
