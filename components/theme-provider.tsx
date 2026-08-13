'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes'

// `ThemeProviderProps` in this version of next-themes does not declare
// `children` — and neither does the component's own prop type, so deriving from
// `React.ComponentProps<typeof NextThemesProvider>` does not help either. The
// children are accepted at runtime; only the type omits them, so they are added
// back explicitly rather than the call site being cast.
export function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps & { children?: React.ReactNode }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
