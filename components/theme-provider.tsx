"use client";

import { useEffect, type ReactNode } from "react";

type Theme = "dark" | "light";

// Brand decision: always the light (white/blue) theme — do not follow the OS
// color-scheme preference.
export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  useEffect(() => {
    applyTheme("light");
  }, []);

  return children;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}
