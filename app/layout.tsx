import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "OPTIONS-CALCULATORS.COM",
  description:
    "Empower your options trading with cutting-edge calculators: Fear & Greed Index, Fed rate predictions, market trend analysis, and smart strategy suggestions. Optimize profits and trade smarter—start now at Options-Calculators.com!",
  generator: "v0.app",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "OPTIONS-CALCULATORS.COM",
    description:
      "Empower your options trading with cutting-edge calculators: Fear & Greed Index, Fed rate predictions, market trend analysis, and smart strategy suggestions. Optimize profits and trade smarter—start now at Options-Calculators.com!",
    url: "https://options-calculators.com",
    siteName: "Options Calculators",
    images: [
      {
        url: "/og-image.png", // You'll need to provide this image
        width: 1200,
        height: 630,
        alt: "Options Calculators - Professional Trading Tools",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OPTIONS-CALCULATORS.COM",
    description:
      "Empower your options trading with cutting-edge calculators: Fear & Greed Index, Fed rate predictions, market trend analysis, and smart strategy suggestions. Optimize profits and trade smarter—start now at Options-Calculators.com!",
    images: ["/og-image.png"], // You'll need to provide this image
  },
  keywords: [
    "options trading",
    "options calculator",
    "fear and greed index",
    "fed rate predictions",
    "market sentiment",
    "trading strategies",
    "options Greeks",
    "volatility calculator",
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>{children}</body>
    </html>
  )
}
