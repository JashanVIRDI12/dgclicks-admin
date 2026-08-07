"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ListMenu } from "@/features/tasks/components/board/list-menu";
import { SortableTaskCard } from "@/features/tasks/components/board/task-card";
import type { List, Task } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  list,
  tasks,
  onOpenTask,
  onCreateTask,
  canDeleteList,
  canEdit,
}: {
  list: List;
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
  onCreateTask: (listId: string) => void;
  canDeleteList: boolean;
  canEdit: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: list.id,
    data: { type: "list" },
    disabled: !canEdit,
  });

  // A separate droppable on the body lets an empty column accept a card.
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `list:${list.id}`,
    data: { type: "list", listId: list.id },
    disabled: !canEdit,
  });

  const taskIds = tasks.map((task) => task.id);

  return (
    <section
      ref={setSortableRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={list.name}
      className={cn(
        "flex max-h-full w-[19rem] shrink-0 flex-col rounded-2xl bg-surface",
        isDragging && "opacity-50",
      )}
    >
      <header className="flex items-center gap-1.5 px-3 py-2.5">
        {canEdit ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${list.name}`}
            className="-ml-1 cursor-grab touch-none rounded p-1 text-muted-foreground/0 transition-colors group-hover/board:text-muted-foreground/60 hover:text-foreground focus-visible:text-foreground"
          >
            <GripVerticalIcon className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}

        <h2 className="flex-1 truncate text-sm font-medium">{list.name}</h2>
        <span className="rounded-md px-1.5 text-xs tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
        {canEdit ? <ListMenu list={list} canDelete={canDeleteList} /> : null}
      </header>

      <div
        ref={setDroppableRef}
        className={cn(
          "scrollbar-subtle flex min-h-2 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 transition-colors",
          isOver && "bg-accent/40",
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onOpen={() => onOpenTask(task.id)}
              canDrag={canEdit}
            />
          ))}
        </SortableContext>
      </div>

      {canEdit ? <div className="px-2 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCreateTask(list.id)}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          Add task
        </Button>
      </div> : null}
    </section>
  );
}
