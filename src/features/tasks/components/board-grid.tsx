import Link from "next/link";
import type { Route } from "next";

import { Progress } from "@/components/ui/progress";
import { BoardIcon } from "@/features/tasks/components/board-icon";
import type { BoardSummary } from "@/features/tasks/types";

/**
 * The board index.
 *
 * Each card leads with the three numbers that decide whether a board needs
 * attention — how much is open, how much is done, how much is late — because
 * "which board do I open" is the only question this page answers.
 */
function BoardCard({ board }: { board: BoardSummary }) {
  const openCount = board.taskCount - board.completedCount;
  const percentComplete =
    board.taskCount === 0
      ? 0
      : Math.round((board.completedCount / board.taskCount) * 100);

  return (
    <Link
      href={`/boards/${board.id}` as Route}
      className="group flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift focus-visible:-translate-y-0.5 focus-visible:shadow-lift"
    >
      <div className="flex items-start gap-3">
        <BoardIcon icon={board.icon} color={board.color} />

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{board.name}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-pretty text-muted-foreground">
            {board.description ?? "No description"}
          </p>
        </div>
      </div>

      <div className="mt-auto space-y-2.5">
        <Progress
          value={percentComplete}
          aria-label={`${percentComplete}% complete`}
          className="h-1"
        />

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{openCount}</span> open
          </span>
          <span>
            <span className="font-medium text-foreground">
              {board.completedCount}
            </span>{" "}
            done
          </span>
          {board.overdueCount > 0 ? (
            <span
              className="ml-auto font-medium"
              style={{ color: "var(--priority-urgent)" }}
            >
              {board.overdueCount} overdue
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function BoardGrid({ boards }: { boards: BoardSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {boards.map((board) => (
        <BoardCard key={board.id} board={board} />
      ))}
    </div>
  );
}
