import type { MetadataRoute } from "next"

/**
 * The whole site is a private club (owner decision 2026-08-14): a search
 * engine has no business indexing the door, and everything behind it is
 * session-gated anyway. Disallow everything.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  }
}
