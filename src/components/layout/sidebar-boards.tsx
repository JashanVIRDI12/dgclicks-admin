"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { moveBoardAction } from "@/features/tasks/actions/board.actions";
import { BOARD_ICON_COMPONENTS } from "@/features/tasks/components/board-icon";
import type { Board } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

function BoardLink({
  board,
  isActive,
  isCollapsed,
  onNavigate,
  canReorder,
}: {
  board: Board;
  isActive: boolean;
  isCollapsed: boolean;
  onNavigate?: () => void;
  canReorder: boolean;
}) {
  const Icon = BOARD_ICON_COMPONENTS[board.icon];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: board.id, disabled: !canReorder });

  const link = (
    <Link
      href={`/boards/${board.id}` as Route}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
        "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        isActive && "bg-sidebar-accent text-sidebar-foreground",
        isCollapsed && "justify-center px-0",
      )}
    >
      <Icon
        className="size-4 shrink-0"
        style={{ color: `var(--label-${board.color})` }}
        aria-hidden="true"
      />
      <span className={cn("truncate", isCollapsed && "sr-only")}>
        {board.name}
      </span>
    </Link>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // The whole row is the handle. A separate grip in a 60px-wide sidebar
      // would be smaller than the thing it drags.
      {...(canReorder ? attributes : {})}
      {...(canReorder ? listeners : {})}
      className={cn(canReorder && "touch-none", isDragging && "opacity-50")}
    >
      {isCollapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{board.name}</TooltipContent>
        </Tooltip>
      ) : (
        link
      )}
    </div>
  );
}

/**
 * The workspace's boards, directly in the sidebar and reorderable.
 *
 * Boards are where the work is, so making people go via an index page to reach
 * one would add a click to the most common navigation in the app. The icon
 * carries the board's colour so the list is scannable at a glance rather than
 * a column of identical rows.
 */
export function SidebarBoards({
  boards,
  contextId,
  isCollapsed = false,
  onNavigate,
  canReorder,
}: {
  boards: Board[];
  /** Stable and unique when desktop and mobile navigation coexist in the DOM. */
  contextId: "desktop" | "mobile";
  isCollapsed?: boolean;
  onNavigate?: () => void;
  canReorder: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  /**
   * A local copy so the list settles the instant it is dropped. Re-synced
   * during render when the server sends a new order — the tracked-previous
   * pattern, rather than an effect that would flash the old order first.
   */
  const [order, setOrder] = useState(boards);
  const [synced, setSynced] = useState(boards);

  if (synced !== boards) {
    setSynced(boards);
    setOrder(boards);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (boards.length === 0) {
    return null;
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!canReorder) {
      return;
    }

    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const from = order.findIndex((board) => board.id === active.id);
    const to = order.findIndex((board) => board.id === over.id);

    if (from === -1 || to === -1) {
      return;
    }

    const next = arrayMove(order, from, to);
    setOrder(next);

    const index = next.findIndex((board) => board.id === active.id);
    const previous = order;

    startTransition(async () => {
      const result = await moveBoardAction({
        id: String(active.id),
        beforeId: next[index - 1]?.id ?? null,
        afterId: next[index + 1]?.id ?? null,
      });

      if (!result.ok) {
        setOrder(previous);
        toast.error(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <p
        className={cn(
          "px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase",
          isCollapsed && "sr-only",
        )}
      >
        Boards
      </p>

      <DndContext
        id={`${contextId}-sidebar-boards-${boards[0]?.workspaceId ?? "empty"}`}
        sensors={canReorder ? sensors : []}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={order.map((board) => board.id)}
          strategy={verticalListSortingStrategy}
        >
          {order.map((board) => (
            <BoardLink
              key={board.id}
              board={board}
              isActive={pathname === `/boards/${board.id}`}
              isCollapsed={isCollapsed}
              onNavigate={onNavigate}
              canReorder={canReorder}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
