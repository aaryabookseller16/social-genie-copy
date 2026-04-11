"use client";

import { ThemeProvider } from "next-themes";
import { NotificationsBoot } from "./components/shared/NotificationsBoot";
import { PwaBoot } from "./components/shared/PwaBoot";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      storageKey="genie-theme"
      disableTransitionOnChange
    >
      <PwaBoot />
      <NotificationsBoot />
      {children}
    </ThemeProvider>
  );
}
