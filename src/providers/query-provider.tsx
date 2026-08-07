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
        // Most data in an internal tool is not changing second to second.
        // A minute of staleness removes a lot of redundant refetching.
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        // Refetching every time the window regains focus is noisy on a
        // dashboard people leave open all day.
        refetchOnWindowFocus: false,
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
