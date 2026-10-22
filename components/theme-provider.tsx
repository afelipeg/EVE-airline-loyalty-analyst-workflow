"use client"

// next-themes, with the four props every ReUI template uses. It exists as its
// own file for one reason: the root layout is a server component and
// next-themes needs a client boundary, so this is the "use client" seam.
//
// The props are fixed across the catalog, not per template:
//   attribute="class"          the `.dark` class every ReUI token block keys off
//   defaultTheme="system"      follow the OS until the visitor picks otherwise
//   enableSystem               keep following it while "system" is selected
//   disableTransitionOnChange  suppress transitions during the swap, so a theme
//                              change is instant instead of a slow colour crossfade
//
// No `storageKey` is passed anywhere in the catalog: every template reads and
// writes next-themes' default `theme` key, so a shared-origin preview does not
// end up with two competing preferences.
//
// Callers may still override any prop; `{...props}` is last on purpose.

import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
