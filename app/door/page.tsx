import type { Metadata } from "next"
import { DoorCalculator } from "@/components/door-calculator"

/**
 * The anonymous front page. Never linked to by name: the middleware REWRITES
 * "/" here for signed-out visitors (and redirects a direct /door hit back to
 * "/"), so the calculator has exactly one public URL. Everything else on the
 * site — pages and API routes alike — requires a session.
 */
export const metadata: Metadata = {
  title: "Calculator",
  description: "A simple calculator.",
  robots: { index: false, follow: false },
}

export default function DoorPage() {
  return <DoorCalculator />
}
