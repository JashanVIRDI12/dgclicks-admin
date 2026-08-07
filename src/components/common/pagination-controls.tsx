"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";

import { Button } from "@/components/ui/button";

/**
 * URL-driven pagination, shared by any list view.
 *
 * The page number lives in the query string for the same reason filters do: the
 * view stays linkable and the back button behaves.
 */
export function PaginationControls({
  page,
  pageSize,
  total,
  hasMore,
}: {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (total <= pageSize) {
    return null;
  }

  const firstOnPage = (page - 1) * pageSize + 1;
  const lastOnPage = Math.min(page * pageSize, total);

  function goTo(nextPage: number) {
    const params = new URLSearchParams(searchParams);

    if (nextPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }

    router.push(`${pathname}?${params.toString()}` as Route);
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {firstOnPage}–{lastOnPage} of {total}
      </p>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => goTo(page - 1)}
        >
          <ChevronLeftIcon className="size-4" />
          Previous
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore}
          onClick={() => goTo(page + 1)}
        >
          Next
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
