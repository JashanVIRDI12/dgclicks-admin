"use client";

import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * Short, because this is a shared workspace.
         *
         * A minute of staleness is fine for data only you can change. It is
         * wrong for a board several people are working on at once: it meant a
         * colleague's new task was invisible until something else happened to
         * invalidate the query, which in practice meant reloading the page.
         */
        staleTime: 10 * 1000,
        gcTime: 5 * 60 * 1000,
        /**
         * Coming back to the tab is the strongest possible signal that someone
         * is about to look at this data, so it is the cheapest possible moment
         * to make sure it is true. This was off to keep an idle dashboard quiet
         * — but an idle tab issues no focus events, so it was paying that cost
         * only in the one case where the refetch was worth it.
         */
        refetchOnWindowFocus: true,
        /** Back from a dropped connection, assume everything moved on. */
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          // Never retry an auth or validation failure — the answer will not
          // change, and retrying a 401 just delays the redirect.
          const status = (error as { status?: number }).status;
          if (status && status >= 400 && status < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * One client per browser tab, a fresh one per server render.
 *
 * Reusing a client across server renders would leak one user's cached data into
 * another's response; creating a new one on every client render would throw the
 * cache away on each suspense boundary.
 */
function getQueryClient(): QueryClient {
  if (isServer) {
    return createQueryClient();
  }

  return (browserQueryClient ??= createQueryClient());
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
