"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { UserSummary } from "@/features/auth/types";
import { createListAction, moveListAction } from "@/features/tasks/actions/board.actions";
import { CreateTaskSheet } from "@/features/tasks/components/board/create-task-sheet";
import { KanbanColumn } from "@/features/tasks/components/board/kanban-column";
import { TaskCard } from "@/features/tasks/components/board/task-card";
import { useMoveTask } from "@/features/tasks/hooks/use-board";
import type { BoardSnapshot, List, Task } from "@/features/tasks/types";

/** Tasks per column, in display order. */
type Columns = Record<string, Task[]>;

function groupByList(tasks: Task[], lists: List[]): Columns {
  const columns: Columns = {};

  for (const list of lists) {
    columns[list.id] = [];
  }

  for (const task of tasks) {
    columns[task.listId]?.push(task);
  }

  for (const listId of Object.keys(columns)) {
    columns[listId]?.sort((a, b) => a.position - b.position);
  }

  return columns;
}

/** The column an id belongs to. Accepts a task id or a column's droppable id. */
function containerOf(id: string, columns: Columns): string | null {
  if (id.startsWith("list:")) {
    return id.slice("list:".length);
  }

  if (columns[id]) {
    return id;
  }

  for (const [listId, tasks] of Object.entries(columns)) {
    if (tasks.some((task) => task.id === id)) {
      return listId;
    }
  }

  return null;
}

export function KanbanBoard({
  snapshot,
  members,
  onOpenTask,
  canEdit,
}: {
  snapshot: BoardSnapshot;
  members: UserSummary[];
  onOpenTask: (taskId: string) => void;
  canEdit: boolean;
}) {
  const router = useRouter();
  const boardId = snapshot.board.id;
  const moveTask = useMoveTask(boardId);
  const [, startTransition] = useTransition();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const originListId = useRef<string | null>(null);
  /**
   * A working copy held only while something is in the air.
   *
   * The cache is the source of truth; during a drag the preview has to reorder
   * faster than a round trip, and writing every intermediate hover into the
   * query cache would make each one a re-render of the whole board.
   */
  const [dragColumns, setDragColumns] = useState<Columns | null>(null);
  const [isAddingList, setAddingList] = useState(false);
  const [createListId, setCreateListId] = useState<string | null>(null);

  const columns = dragColumns ?? groupByList(snapshot.tasks, snapshot.lists);
  const listIds = snapshot.lists.map((list) => list.id);
  const createList = snapshot.lists.find((list) => list.id === createListId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Small threshold so a click still opens the card instead of every press
      // being read as the start of a drag.
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Space alone drives keyboard dragging, which leaves Enter free to open
      // the focused card. dnd-kit binds both by default.
      keyboardCodes: {
        start: ["Space"],
        cancel: ["Escape"],
        end: ["Space"],
      },
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    if (!canEdit) {
      return;
    }

    const type = event.active.data.current?.type;

    if (type === "task") {
      const task = snapshot.tasks.find((item) => item.id === event.active.id);
      originListId.current = task?.listId ?? null;
      setActiveTask(task ?? null);
      setDragColumns(groupByList(snapshot.tasks, snapshot.lists));
    }
  }

  /**
   * Cross-column movement is applied live so the card is visibly in its new
   * column before it is dropped. Once it crosses, its working order continues
   * to follow the pointer instead of jumping into place on release.
   */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;

    if (!over || active.data.current?.type !== "task" || !dragColumns) {
      return;
    }

    const from = containerOf(String(active.id), dragColumns);
    const to = containerOf(String(over.id), dragColumns);

    if (!from || !to) {
      return;
    }

    setDragColumns((current) => {
      if (!current) {
        return current;
      }

      if (from === to) {
        if (from === originListId.current) {
          return current;
        }

        const tasks = current[from] ?? [];
        const fromIndex = tasks.findIndex((task) => task.id === active.id);
        const overIndex = tasks.findIndex((task) => task.id === over.id);

        if (fromIndex === -1 || overIndex === -1 || fromIndex === overIndex) {
          return current;
        }

        return { ...current, [from]: arrayMove(tasks, fromIndex, overIndex) };
      }

      const source = current[from] ?? [];
      const destination = current[to] ?? [];
      const moving = source.find((task) => task.id === active.id);

      if (!moving) {
        return current;
      }

      const overIndex = destination.findIndex((task) => task.id === over.id);
      const isBelowOver =
        active.rect.current.translated !== null &&
        active.rect.current.translated.top > over.rect.top + over.rect.height;
      const insertAt =
        overIndex === -1
          ? destination.length
          : Math.min(overIndex + (isBelowOver ? 1 : 0), destination.length);

      return {
        ...current,
        [from]: source.filter((task) => task.id !== active.id),
        [to]: [
          ...destination.slice(0, insertAt),
          { ...moving, listId: to },
          ...destination.slice(insertAt),
        ],
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const type = active.data.current?.type;
    const startedInList = originListId.current;

    originListId.current = null;
    setActiveTask(null);

    if (!over) {
      setDragColumns(null);
      return;
    }

    if (type === "list") {
      handleListDrop(String(active.id), String(over.id));
      return;
    }

    const working = dragColumns;

    if (!working) {
      return;
    }

    const listId = containerOf(String(active.id), working);

    if (!listId) {
      return;
    }

    const current = working[listId] ?? [];
    const fromIndex = current.findIndex((task) => task.id === active.id);
    const overIndex = current.findIndex((task) => task.id === over.id);
    const finalOrder =
      startedInList !== listId || overIndex === -1 || fromIndex === overIndex
        ? current
        : arrayMove(current, fromIndex, overIndex);

    const index = finalOrder.findIndex((task) => task.id === active.id);

    if (index === -1) {
      setDragColumns(null);
      return;
    }

    // Neighbours rather than an index: positions are fractional, and an index
    // would be stale the moment anyone else reordered the same column.
    moveTask.mutate({
      id: String(active.id),
      listId,
      beforeId: finalOrder[index - 1]?.id ?? null,
      afterId: finalOrder[index + 1]?.id ?? null,
    });

    // Keep the settled preview for one frame while the optimistic cache takes
    // ownership. Clearing it in the same tick exposes the old snapshot.
    requestAnimationFrame(() => setDragColumns(null));
  }

  function handleListDrop(activeId: string, overId: string) {
    const overListId = overId.startsWith("list:")
      ? overId.slice("list:".length)
      : overId;

    const fromIndex = listIds.indexOf(activeId);
    const toIndex = listIds.indexOf(overListId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return;
    }

    const reordered = arrayMove(listIds, fromIndex, toIndex);
    const index = reordered.indexOf(activeId);

    startTransition(async () => {
      const result = await moveListAction({
        id: activeId,
        beforeId: reordered[index - 1] ?? null,
        afterId: reordered[index + 1] ?? null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      router.refresh();
    });
  }

  function handleAddList() {
    setAddingList(true);

    startTransition(async () => {
      const result = await createListAction({
        boardId,
        name: "New column",
        isTerminal: false,
      });

      setAddingList(false);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <DndContext
      id={`board-${boardId}`}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        originListId.current = null;
        setActiveTask(null);
        setDragColumns(null);
      }}
    >
      <div className="group/board scrollbar-subtle flex h-full gap-3 overflow-x-auto pb-4">
        <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
          {snapshot.lists.map((list) => (
            <KanbanColumn
              key={list.id}
              list={list}
              tasks={columns[list.id] ?? []}
              onOpenTask={onOpenTask}
              onCreateTask={setCreateListId}
              canDeleteList={snapshot.lists.length > 1}
              canEdit={canEdit}
            />
          ))}
        </SortableContext>

        {canEdit ? (
          <Button
            variant="ghost"
            onClick={handleAddList}
            disabled={isAddingList}
            className="h-10 w-56 shrink-0 justify-start text-muted-foreground hover:text-foreground"
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            Add column
          </Button>
        ) : null}
      </div>

      {canEdit ? (
        <CreateTaskSheet
          open={createListId !== null}
          onOpenChange={(open) => {
            if (!open) setCreateListId(null);
          }}
          boardId={boardId}
          listId={createListId}
          listName={createList?.name ?? null}
          labels={snapshot.labels}
          members={members}
        />
      ) : null}

      <DragOverlay
        dropAnimation={{ duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
