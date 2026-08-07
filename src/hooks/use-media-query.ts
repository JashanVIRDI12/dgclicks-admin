"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query.
 *
 * Uses `useSyncExternalStore` rather than effect-plus-state: `matchMedia` is an
 * external store, and reading it through the dedicated API avoids the extra
 * render pass an effect would cause on mount.
 *
 * The server snapshot is always `false`, so never branch page structure on this
 * — it is for behaviour (auto-closing the mobile nav on resize), not layout,
 * which Tailwind's breakpoints handle without a hydration mismatch.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", onStoreChange);

      return () => mediaQuery.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
