/**
 * Single source of truth for app-level identity. Imported by metadata, the
 * sidebar brand and the auth screens so the name is never hardcoded twice.
 */
export const siteConfig = {
  name: "DG Clicks",
  shortName: "DG",
  description: "Internal operating system for DG Clicks.",
} as const;
