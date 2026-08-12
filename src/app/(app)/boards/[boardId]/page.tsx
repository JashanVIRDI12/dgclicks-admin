import { ArchiveIcon, ArrowLeftIcon, EyeIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  getSession,
  getSessionRole,
  requireSession,
} from "@/features/auth/server/session";
import { BoardIcon } from "@/features/tasks/components/board-icon";
import { BoardMenu } from "@/features/tasks/components/board-menu";
import { BoardWorkspace } from "@/features/tasks/components/board/board-workspace";
import { WorkspaceBanner } from "@/features/tasks/components/workspace-banner";
import { BOARD_VIEWS, DEFAULT_BOARD_VIEW } from "@/features/tasks/constants";
import { canEditBoard, canManageWorkspace } from "@/features/tasks/permissions";
import { getActiveWorkspaceContext } from "@/features/tasks/server/active-workspace";
import {
  assertBoardAccess,
  getBoardById,
  getBoardSnapshot,
} from "@/features/tasks/server/board.service";
import { catchUpRecurrences } from "@/features/tasks/server/recurrence.service";
import { archiveCompletedTasks } from "@/features/tasks/server/task.service";
import { getWorkspaceById } from "@/features/tasks/server/workspace.service";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export async function generateMetadata({
  params,
}: PageProps<"/boards/[boardId]">): Promise<Metadata> {
  const { boardId } = await params;

  try {
    const session = await getSession();

    if (!session) {
      return { title: "Board" };
    }

    await assertBoardAccess(boardId, session.user.id);
    const board = await getBoardById(boardId);
    return { title: board.name };
  } catch {
    return { title: "Board" };
  }
}

export default async function BoardPage({
  params,
  searchParams,
}: PageProps<"/boards/[boardId]">) {
  const session = await requireSession();
  const { boardId } = await params;

  try {
    await assertBoardAccess(boardId, session.user.id);
  } catch (error) {
    // A board that is missing and a board you cannot see are the same 404 to
    // the person asking: distinguishing them would confirm that an id exists.
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      notFound();
    }

    throw error;
  }

  // Generation happens on read, which is the trade-off for having no scheduler.
  // It is claimed atomically, so two people opening this board at once still
  // produce one occurrence. Awaited before the snapshot because a task it spawns
  // has to be in the snapshot it spawned during, not the next one.
  await Promise.all([
    catchUpRecurrences([boardId]),
    // Retires work finished more than a day ago, so Done stays a record of what
    // just happened rather than everything that ever has.
    archiveCompletedTasks([boardId]),
  ]);

  // `searchParams` resolves locally, so it joins the round trips rather than
  // waiting behind them.
  const [query, snapshot, { active }] = await Promise.all([
    searchParams,
    getBoardSnapshot(boardId),
    getActiveWorkspaceContext(session.user.id),
  ]);

  const requestedView = Array.isArray(query.view) ? query.view[0] : query.view;
  const requestedTask = Array.isArray(query.task) ? query.task[0] : query.task;

  const boardWorkspace =
    active?.id === snapshot.board.workspaceId
      ? active
      : await getWorkspaceById(snapshot.board.workspaceId);
  const owningWorkspace = active?.id === boardWorkspace.id ? null : boardWorkspace;
  const isAdmin = getSessionRole(session) === "admin";
  const canEdit = canEditBoard(snapshot.board, session.user.id, isAdmin);
  // Setting a board's permissions belongs to whoever runs the workspace the
  // board lives in, which is not the same question as the global role.
  const canManageWorkspaceBoards = canManageWorkspace(
    boardWorkspace,
    session.user.id,
    isAdmin,
  );

  return (
    // The marker the app shell keys its full-bleed layout off — the board needs
    // the whole viewport width and its own scroll container, unlike every other
    // page in the app.
    <div data-board-surface className="flex min-h-0 flex-1 flex-col gap-5">
      {owningWorkspace ? (
        <WorkspaceBanner workspace={owningWorkspace} />
      ) : null}

      <div className="flex items-start gap-3">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="-ml-2 shrink-0 text-muted-foreground md:hidden"
        >
          <Link href="/boards" aria-label="All boards">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>

        <BoardIcon icon={snapshot.board.icon} color={snapshot.board.color} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {snapshot.board.name}
            </h1>
            {snapshot.board.archivedAt ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                <ArchiveIcon className="size-3" aria-hidden="true" />
                Archived
              </span>
            ) : null}
            {!canEdit ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                <EyeIcon className="size-3" aria-hidden="true" />
                View only
              </span>
            ) : null}
          </div>
          {snapshot.board.description ? (
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {snapshot.board.description}
            </p>
          ) : null}
        </div>

        <BoardMenu
          board={snapshot.board}
          taskCount={snapshot.tasks.length}
          isAdmin={isAdmin}
          canEdit={canEdit}
        />
      </div>

      <BoardWorkspace
        initialSnapshot={snapshot}
        initialView={
          BOARD_VIEWS.find((view) => view === requestedView) ??
          DEFAULT_BOARD_VIEW
        }
        initialTaskId={requestedTask ?? null}
        members={boardWorkspace.members}
        currentUser={{
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        }}
        isAdmin={isAdmin}
        canManageWorkspace={canManageWorkspaceBoards}
        canEdit={canEdit}
      />
    </div>
  );
}
