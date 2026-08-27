import type { Metadata } from "next"
import { Suspense } from "react"
import { ResetForm } from "@/components/reset-form"

/**
 * Password reset, members only — public by middleware allowance, like /login.
 * Without a ?token= it asks for an email and requests a link; with one it
 * asks for the new password. The admin credential has no email path (env
 * var); /login's recovery note covers that case.
 */
export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  )
}
