"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** How often a visible tab re-renders its server components. */
const INTERVAL_MS = 30_000;

/**
 * Keeps the server-rendered pages current without a reload.
 *
 * The board owns its data through TanStack Query and refetches itself. Every
 * other screen — dashboard, my tasks, calendar, reports, activity, the board
 * index — is a server component, so its data only changes when Next re-renders
 * it. Nothing was asking it to, which is why a task somebody else created stayed
 * invisible until you pressed reload.
 *
 * `router.refresh()` re-runs the server render and reconciles the result into
 * the existing tree: no scroll jump, no lost focus, no flash. It is the RSC
 * equivalent of a refetch, not of a reload.
 *
 * Two triggers, both deliberately conservative:
 *
 *   - **Regaining focus.** Someone returning to the tab is about to read it.
 *   - **A slow interval, only while visible.** Thirty seconds rather than the
 *     board's ten, because these pages are summaries — being half a minute
 *     behind on a dashboard costs nothing, and each refresh is a full server
 *     render rather than one cached query.
 *
 * A hidden tab does neither, so a window left open all weekend is free.
 */
export function LiveRefresh() {
  const router = useRouter();
  // Re-arms on navigation so the timer belongs to the page being looked at.
  const pathname = usePathname();

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }

    const timer = setInterval(refreshIfVisible, INTERVAL_MS);

    // `visibilitychange` rather than `focus`: clicking back into a window that
    // was never hidden fires focus without anything having changed, and on a
    // second monitor that is most clicks.
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router, pathname]);

  return null;
}
