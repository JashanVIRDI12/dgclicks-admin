import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";

import { siteConfig } from "@/config/site";
import { APPEARANCE_INIT_SCRIPT } from "@/features/appearance/appearance-provider";
import { cn } from "@/lib/utils";
import { Providers } from "@/providers";

import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

/**
 * Headings only.
 *
 * Space Grotesk's tighter apertures and squarer terminals give a title weight
 * Geist does not, and the two share enough of a grotesque skeleton that the
 * pairing reads as one voice rather than two fonts. Kept off body copy on
 * purpose: it is a display face, and a paragraph of it is harder to read than
 * the same paragraph in Geist.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  // Internal tool: keep it out of search results entirely.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // `suppressHydrationWarning` is required by next-themes: it writes the
    // theme class onto <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Applies the saved accent, density and surface before first paint, so
          the page never flashes the default indigo on its way to the reader's
          own theme. Same approach next-themes takes for light/dark.
        */}
        <script
          dangerouslySetInnerHTML={{ __html: APPEARANCE_INIT_SCRIPT }}
        />
      </head>
      <body
        className={cn(
          "min-h-svh font-sans antialiased",
          geistSans.variable,
          geistMono.variable,
          spaceGrotesk.variable,
        )}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
