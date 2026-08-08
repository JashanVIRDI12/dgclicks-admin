"use client";

import { useState } from "react";

import { FadeIn } from "@/components/common/fade-in";
import type { UserSummary } from "@/features/auth/types";
import {
  BoardToolbar,
  EMPTY_FILTERS,
  type BoardFilters,
} from "@/features/tasks/components/board/board-toolbar";
import { CalendarView } from "@/features/tasks/components/board/calendar-view";
import { KanbanBoard } from "@/features/tasks/components/board/kanban-board";
import { ListView } from "@/features/tasks/components/board/list-view";
import { TaskDrawer } from "@/features/tasks/components/board/task-drawer";
import { TimelineView } from "@/features/tasks/components/board/timeline-view";
import { DEFAULT_BOARD_VIEW, type BoardView } from "@/features/tasks/constants";
import {
  useBoard,
  useSetTaskComplete,
  useUpdateTask,
} from "@/features/tasks/hooks/use-board";
import type { BoardSnapshot, Task } from "@/features/tasks/types";

function matchesFilters(task: Task, filters: BoardFilters): boolean {
  if (!filters.showCompleted && task.completedAt) {
    return false;
  }

  if (
    filters.priorities.length > 0 &&
    !filters.priorities.includes(task.priority)
  ) {
    return false;
  }

  if (
    filters.assigneeIds.length > 0 &&
    !(task.assignee && filters.assigneeIds.includes(task.assignee.id))
  ) {
    return false;
  }

  if (
    filters.labelIds.length > 0 &&
    !task.labels.some((label) => filters.labelIds.includes(label.id))
  ) {
    return false;
  }

  const query = filters.query.trim().toLowerCase();

  if (query && !task.title.toLowerCase().includes(query)) {
    return false;
  }

  return true;
}

/**
 * Writes the current view and open task into the address bar.
 *
 * `replaceState` rather than `router.push`: Next integrates both with its
 * router, but a push re-runs the server component and refetches the board,
 * which is exactly what "switch views instantly" rules out. Replacing also
 * keeps the back button meaning "leave this board" rather than "undo the last
 * four things I looked at".
 */
function syncUrl(view: BoardView, taskId: string | null): void {
  const params = new URLSearchParams();

  if (view !== DEFAULT_BOARD_VIEW) {
    params.set("view", view);
  }

  if (taskId) {
    params.set("task", taskId);
  }

  const query = params.toString();

  window.history.replaceState(
    null,
    "",
    query ? `${window.location.pathname}?${query}` : window.location.pathname,
  );
}

/**
 * The board, in whichever shape the reader wants it.
 *
 * All four views read one snapshot held in TanStack Query, so switching is a
 * re-render rather than a fetch, and a drag in Kanban is already reflected in
 * Calendar before it is opened.
 */
export function BoardWorkspace({
  initialSnapshot,
  initialView,
  initialTaskId,
  members,
  currentUser,
  isAdmin,
  canManageWorkspace,
  canEdit,
}: {
  initialSnapshot: BoardSnapshot;
  initialView: BoardView;
  initialTaskId: string | null;
  members: UserSummary[];
  currentUser: UserSummary;
  isAdmin: boolean;
  /** Runs the workspace this board is in. Gates the Permissions button. */
  canManageWorkspace: boolean;
  canEdit: boolean;
}) {
  const boardId = initialSnapshot.board.id;
  const { data: snapshot } = useBoard(boardId, initialSnapshot);
  const updateTask = useUpdateTask(boardId);
  const setComplete = useSetTaskComplete(boardId);

  const [view, setView] = useState<BoardView>(initialView);
  const [openTaskId, setOpenTaskId] = useState<string | null>(initialTaskId);
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);

  /**
   * Re-sync when the URL changes from outside — following a link from the
   * activity feed or the command palette lands on this same route with a
   * different `?task=`.
   *
   * Done during render rather than in an effect: React applies it before
   * committing, so there is no flash of the previous card.
   * (https://react.dev/learn/you-might-not-need-an-effect)
   */
  const [previousInitialTaskId, setPreviousInitialTaskId] = useState(initialTaskId);

  if (previousInitialTaskId !== initialTaskId) {
    setPreviousInitialTaskId(initialTaskId);
    setOpenTaskId(initialTaskId);
  }

  function changeView(next: BoardView) {
    setView(next);
    syncUrl(next, openTaskId);
  }

  function openTask(taskId: string | null) {
    setOpenTaskId(taskId);
    syncUrl(view, taskId);
  }

  const visibleTasks = snapshot.tasks.filter((task) =>
    matchesFilters(task, filters),
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <BoardToolbar
        view={view}
        onViewChange={changeView}
        filters={filters}
        onFiltersChange={setFilters}
        board={snapshot.board}
        labels={snapshot.labels}
        members={members}
        canManageWorkspace={canManageWorkspace}
      />

      {/*
        Keyed on the view so each one mounts fresh and fades in. Without the key
        React reconciles a kanban column into a calendar cell and the transition
        reads as a glitch rather than a change of shape.
      */}
      <FadeIn key={view} className="min-h-0 flex-1">
        {view === "kanban" ? (
          <KanbanBoard
            snapshot={{ ...snapshot, tasks: visibleTasks }}
            members={members}
            onOpenTask={openTask}
            canEdit={canEdit}
          />
        ) : view === "list" ? (
          <ListView
            snapshot={snapshot}
            tasks={visibleTasks}
            onOpenTask={openTask}
            onToggleComplete={(taskId, isComplete) =>
              setComplete.mutate({ id: taskId, isComplete })
            }
            canEdit={canEdit}
          />
        ) : view === "calendar" ? (
          <CalendarView
            dndContextId={`board-calendar-${boardId}`}
            tasks={visibleTasks}
            onOpenTask={openTask}
            onReschedule={(taskId, dueDate) =>
              updateTask.mutate({ id: taskId, dueDate })
            }
            editableBoardIds={canEdit ? [boardId] : []}
          />
        ) : (
          <TimelineView tasks={visibleTasks} onOpenTask={openTask} />
        )}
      </FadeIn>

      <TaskDrawer
        taskId={openTaskId}
        boardId={boardId}
        labels={snapshot.labels}
        members={members}
        currentUser={currentUser}
        isAdmin={isAdmin}
        canEdit={canEdit}
        onClose={() => openTask(null)}
        onOpenTask={openTask}
      />
    </div>
  );
}
