"use client";

import { useQuery } from "@tanstack/react-query";
import { LayoutGridIcon, PlusIcon, SparklesIcon } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ASSISTANT_STARTERS } from "@/features/assistant/prompts";
import { navigation } from "@/config/navigation";
import { BOARD_ICON_COMPONENTS } from "@/features/tasks/components/board-icon";
import { BoardFormDialog } from "@/features/tasks/components/board-form-dialog";
import { PriorityIcon } from "@/features/tasks/components/task-meta";
import { QuickTaskDialog } from "@/features/tasks/components/quick-task-dialog";
import { canEditBoard } from "@/features/tasks/permissions";
import type { Board, Task } from "@/features/tasks/types";
import { useUiStore } from "@/stores/ui-store";
import type { ApiResult } from "@/types";

const SEARCH_DEBOUNCE_MS = 180;

async function searchTasks(query: string): Promise<Task[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const payload = (await response.json()) as ApiResult<Task[]>;

  if (!payload.ok) {
    throw new Error(payload.error);
  }

  return payload.data;
}

/**
 * Cmd/Ctrl+K.
 *
 * Destinations and boards come from data already in the layout, so they filter
 * with zero latency; only task titles need the server, and those are debounced.
 * The nav entries are read from `config/navigation.ts` rather than listed again
 * here — a second copy is a second thing to forget to update.
 */
export function CommandPalette({
  boards,
  activeWorkspaceId,
  currentUserId,
  isAdmin,
  canManageWorkspace,
}: {
  boards: Board[];
  activeWorkspaceId: string | null;
  currentUserId: string;
  isAdmin: boolean;
  /** Creating a board is a workspace-management right, not a board one. */
  canManageWorkspace: boolean;
}) {
  const router = useRouter();
  const isOpen = useUiStore((state) => state.isCommandPaletteOpen);
  const setOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const askAssistant = useUiStore((state) => state.askAssistant);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [isCreateBoardOpen, setCreateBoardOpen] = useState(false);
  const [isCreateTaskOpen, setCreateTaskOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(!isOpen);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setOpen]);

  // Debounced separately from the input so typing stays instant while the
  // request that follows it does not fire per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const { data: tasks } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => searchTasks(debounced),
    enabled: isOpen && debounced.trim().length > 1,
    staleTime: 10_000,
  });

  function go(href: Route) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const trimmedQuery = query.trim();
  const boardNames = new Map(boards.map((board) => [board.id, board.name]));
  const editableBoards = boards.filter(
    (board) => canEditBoard(board, currentUserId, isAdmin),
  );

  return (
    <>
      <CommandDialog
        open={isOpen}
        onOpenChange={(open) => {
          setOpen(open);

          if (!open) {
            setQuery("");
          }
        }}
        title="Search"
        description="Find a task or board, or jump to a page."
      >
        {/*
          `shouldFilter={false}`: task results are already filtered by the
          server, and letting cmdk filter them again against the same query
          would hide anything it scored differently. Turning it off also keeps
          the Create group visible while a search term is typed, which is when
          it is most likely to be wanted.
        */}
        <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search, or ask your workspace anything…"
        />

        <CommandList>
          {/*
            No empty state while a query is typed: the Ask row below always
            matches, so "Nothing matches that" would be a lie sitting directly
            above something that does.
          */}
          {trimmedQuery ? null : (
            <CommandEmpty>Nothing matches that.</CommandEmpty>
          )}

          {/*
            First, not last. Anything typed here that is not a task or a page
            is a question, and the palette is already where people type what
            they want — making the assistant the fallback turns a search box
            into a command bar without adding a third place to type.
          */}
          {trimmedQuery ? (
            <CommandGroup heading="Ask">
              <CommandItem
                value="ask-assistant"
                onSelect={() => {
                  setOpen(false);
                  setQuery("");
                  askAssistant(trimmedQuery);
                }}
              >
                <SparklesIcon className="size-4" />
                <span className="truncate">
                  Ask your workspace: “{trimmedQuery}”
                </span>
              </CommandItem>
            </CommandGroup>
          ) : null}

          {/*
            Shown only on an empty palette, where there is room and nothing
            else to look at. These are the questions people do not think to
            ask a task manager, so the blank state is the one place worth
            spending to teach them.
          */}
          {trimmedQuery ? null : (
            <CommandGroup heading="Ask your workspace">
              {ASSISTANT_STARTERS.map((starter) => (
                <CommandItem
                  key={starter.label}
                  value={`starter-${starter.label}`}
                  onSelect={() => {
                    setOpen(false);
                    askAssistant(starter.prompt);
                  }}
                >
                  <SparklesIcon className="size-4 text-brand" />
                  {starter.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {tasks && tasks.length > 0 ? (
            <CommandGroup heading="Tasks">
              {tasks.map((task) => (
                <CommandItem
                  key={task.id}
                  value={`task-${task.id}`}
                  onSelect={() =>
                    go(`/boards/${task.boardId}?task=${task.id}` as Route)
                  }
                >
                  <PriorityIcon priority={task.priority} />
                  <span className="flex-1 truncate">{task.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {boardNames.get(task.boardId)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {(() => {
            const term = query.trim().toLowerCase();
            const matchingBoards = term
              ? boards.filter((board) =>
                  board.name.toLowerCase().includes(term),
                )
              : boards;

            return matchingBoards.length > 0 ? (
              <CommandGroup heading="Boards">
                {matchingBoards.slice(0, 6).map((board) => {
                  const Icon = BOARD_ICON_COMPONENTS[board.icon];

                  return (
                    <CommandItem
                      key={board.id}
                      value={`board-${board.id}`}
                      onSelect={() => go(`/boards/${board.id}` as Route)}
                    >
                      <Icon
                        className="size-4"
                        style={{ color: `var(--label-${board.color})` }}
                      />
                      {board.name}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null;
          })()}

          {(() => {
            const term = query.trim().toLowerCase();
            const destinations = navigation
              .flatMap((section) => section.items)
              .filter(
                (item) =>
                  !term ||
                  item.title.toLowerCase().includes(term) ||
                  item.keywords?.some((keyword) => keyword.includes(term)),
              );

            return destinations.length > 0 ? (
              <CommandGroup heading="Go to">
                {destinations.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`nav-${item.href}`}
                    onSelect={() => go(item.href)}
                  >
                    <item.icon className="size-4" />
                    <span className="flex-1">{item.title}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {item.description}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null;
          })()}

          <CommandSeparator />

          <CommandGroup heading="Create">
            <CommandItem
              value="create-task"
              disabled={editableBoards.length === 0}
              onSelect={() => {
                setOpen(false);
                setCreateTaskOpen(true);
              }}
            >
              <PlusIcon className="size-4" />
              New task
            </CommandItem>

            {canManageWorkspace ? (
              <CommandItem
                value="create-board"
                disabled={activeWorkspaceId === null}
                onSelect={() => {
                  setOpen(false);
                  setCreateBoardOpen(true);
                }}
              >
                <LayoutGridIcon className="size-4" />
                New board
              </CommandItem>
            ) : null}
          </CommandGroup>
        </CommandList>
        </Command>
      </CommandDialog>

      <QuickTaskDialog
        open={isCreateTaskOpen}
        onOpenChange={setCreateTaskOpen}
        boards={editableBoards}
      />

      {activeWorkspaceId && canManageWorkspace ? (
        <BoardFormDialog
          workspaceId={activeWorkspaceId}
          open={isCreateBoardOpen}
          onOpenChange={setCreateBoardOpen}
        />
      ) : null}
    </>
  );
}
