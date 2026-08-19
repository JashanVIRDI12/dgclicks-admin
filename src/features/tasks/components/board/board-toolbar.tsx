"use client";

import {
  ArrowDownWideNarrowIcon,
  CalendarDaysIcon,
  CheckIcon,
  GanttChartIcon,
  KanbanIcon,
  ListIcon,
  SearchIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { AskAiButton } from "@/features/assistant/components/ask-ai-button";
import { boardAssistantActions } from "@/features/assistant/prompts";
import { BoardPermissionsDialog } from "@/features/tasks/components/board-permissions-dialog";
import type { BoardSort } from "@/features/tasks/components/board/kanban-board";
import { LabelDot } from "@/features/tasks/components/label-chip";
import { PriorityIcon } from "@/features/tasks/components/task-meta";
import {
  BOARD_VIEWS,
  BOARD_VIEW_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type BoardView,
  type TaskPriority,
} from "@/features/tasks/constants";
import type { UserSummary } from "@/features/auth/types";
import type { Board, Label } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

export type BoardFilters = {
  query: string;
  assigneeIds: string[];
  labelIds: string[];
  priorities: TaskPriority[];
  showCompleted: boolean;
};

export const EMPTY_FILTERS: BoardFilters = {
  query: "",
  assigneeIds: [],
  labelIds: [],
  priorities: [],
  showCompleted: true,
};

const VIEW_ICONS: Record<BoardView, LucideIcon> = {
  kanban: KanbanIcon,
  list: ListIcon,
  calendar: CalendarDaysIcon,
  timeline: GanttChartIcon,
};

function countActiveFilters(filters: BoardFilters): number {
  return (
    filters.assigneeIds.length +
    filters.labelIds.length +
    filters.priorities.length +
    (filters.showCompleted ? 0 : 1)
  );
}

/** Adds or removes a value, for the multi-select filter menus. */
function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function BoardToolbar({
  view,
  onViewChange,
  filters,
  onFiltersChange,
  board,
  labels,
  members,
  canManageWorkspace,
  sort,
  onSortChange,
}: {
  view: BoardView;
  onViewChange: (view: BoardView) => void;
  filters: BoardFilters;
  onFiltersChange: (filters: BoardFilters) => void;
  board: Board;
  labels: Label[];
  members: UserSummary[];
  /**
   * Who may see and change a board is decided by whoever runs its workspace —
   * the creator, an appointed manager, or a global admin.
   */
  canManageWorkspace: boolean;
  /** Card order inside a column. Only the Board view honours it. */
  sort: BoardSort;
  onSortChange: (sort: BoardSort) => void;
}) {
  const activeCount = countActiveFilters(filters);
  const [isPermissionsOpen, setPermissionsOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex items-center gap-0.5 rounded-lg bg-surface p-0.5"
        role="tablist"
        aria-label="View"
      >
        {BOARD_VIEWS.map((option) => {
          const Icon = VIEW_ICONS[option];
          const isActive = option === view;

          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onViewChange(option)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">
                {BOARD_VIEW_LABELS[option]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative min-w-40 flex-1 sm:max-w-64">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        {/*
          Filtering happens on the loaded snapshot, so there is nothing to
          debounce — every keystroke is a local array filter, not a request.
        */}
        <Input
          value={filters.query}
          onChange={(event) =>
            onFiltersChange({ ...filters, query: event.target.value })
          }
          placeholder="Filter tasks…"
          aria-label="Filter tasks"
          className="h-8 pl-8 text-sm"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <SlidersHorizontalIcon className="size-3.5" aria-hidden="true" />
            Filter
            {activeCount > 0 ? (
              <span className="ml-0.5 rounded bg-primary px-1.5 text-[0.6875rem] tabular-nums text-primary-foreground">
                {activeCount}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Priority
          </DropdownMenuLabel>
          {TASK_PRIORITIES.map((priority) => (
            <DropdownMenuCheckboxItem
              key={priority}
              checked={filters.priorities.includes(priority)}
              onCheckedChange={() =>
                onFiltersChange({
                  ...filters,
                  priorities: toggle(filters.priorities, priority),
                })
              }
              onSelect={(event) => event.preventDefault()}
            >
              <PriorityIcon priority={priority} />
              {TASK_PRIORITY_LABELS[priority]}
            </DropdownMenuCheckboxItem>
          ))}

          {members.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Assignee
              </DropdownMenuLabel>
              {members.map((member) => (
                <DropdownMenuCheckboxItem
                  key={member.id}
                  checked={filters.assigneeIds.includes(member.id)}
                  onCheckedChange={() =>
                    onFiltersChange({
                      ...filters,
                      assigneeIds: toggle(filters.assigneeIds, member.id),
                    })
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  <span className="truncate">{member.name}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </>
          ) : null}

          {labels.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Labels
              </DropdownMenuLabel>
              {labels.map((label) => (
                <DropdownMenuCheckboxItem
                  key={label.id}
                  checked={filters.labelIds.includes(label.id)}
                  onCheckedChange={() =>
                    onFiltersChange({
                      ...filters,
                      labelIds: toggle(filters.labelIds, label.id),
                    })
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  <LabelDot color={label.color} />
                  <span className="truncate">{label.name}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </>
          ) : null}

          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={filters.showCompleted}
            onCheckedChange={(checked) =>
              onFiltersChange({ ...filters, showCompleted: checked })
            }
            onSelect={(event) => event.preventDefault()}
          >
            <CheckIcon className="size-3.5" aria-hidden="true" />
            Show completed
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/*
        Only offered on the Board view. List, Calendar and Timeline each impose
        their own order — a sort control that visibly did nothing on three of
        four views would be worse than not having one.
      */}
      {view === "kanban" ? (
        <Button
          variant={sort === "priority" ? "secondary" : "outline"}
          size="sm"
          className="h-8"
          aria-pressed={sort === "priority"}
          onClick={() =>
            onSortChange(sort === "priority" ? "manual" : "priority")
          }
          title={
            sort === "priority"
              ? "Sorted by priority — dragging is off. Click to return to manual order."
              : "Sort every column by priority"
          }
        >
          <ArrowDownWideNarrowIcon className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">
            {sort === "priority" ? "By priority" : "Sort"}
          </span>
        </Button>
      ) : null}

      {canManageWorkspace ? (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setPermissionsOpen(true)}
          >
            <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Permissions</span>
          </Button>

          <BoardPermissionsDialog
            board={board}
            members={members}
            open={isPermissionsOpen}
            onOpenChange={setPermissionsOpen}
          />
        </>
      ) : null}

      {activeCount > 0 || filters.query ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground"
          onClick={() => onFiltersChange(EMPTY_FILTERS)}
        >
          <XIcon className="size-3.5" aria-hidden="true" />
          Clear
        </Button>
      ) : null}

      {/* Named so the assistant can find this board by title. */}
      <AskAiButton
        actions={boardAssistantActions(board.name)}
        className="h-8"
      />
    </div>
  );
}
