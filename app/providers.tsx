"use client";

import { ThemeProvider } from "next-themes";
import { PwaBoot } from "./components/shared/PwaBoot";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <PwaBoot />
      {children}
    </ThemeProvider>
  );
}
