"use client";

import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";

/**
 * Every client-side provider, composed once so the root layout stays a server
 * component with a single client boundary at the top.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster position="bottom-right" closeButton richColors={false} />
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
