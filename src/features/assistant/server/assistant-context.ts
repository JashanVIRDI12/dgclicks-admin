import "server-only";

import { recallMemories } from "@/features/assistant/server/assistant-memory";
import { getSessionRole } from "@/features/auth/server/session";
import type { AuthenticatedSession } from "@/features/auth/server/session";
import { getBoardSnapshot, listBoards } from "@/features/tasks/server/board.service";
import { getDashboardData } from "@/features/tasks/server/insights.service";
import { getWorkspaceById } from "@/features/tasks/server/workspace.service";

/**
 * What the assistant knows before it is asked anything.
 *
 * The old prompt handed the model six lines of ids — `Active workspace id:
 * 68f2…` — and nothing else. Every question therefore began with the model
 * spending tool calls discovering facts the server already had, which is why it
 * answered "I found the **Seo** board (id 6a76cae…)" instead of just answering,
 * and why it asked which workspace you meant when there was only ever one.
 *
 * This assembles the same snapshot a person would have glanced at before
 * speaking: where they are, who is around, what is late.
 *
 * Three rules hold it together:
 *
 *  - **It is built from the same services the UI uses.** `listBoards` applies
 *    the private-board filter inside the query, so a board the user cannot see
 *    cannot reach the prompt — and therefore cannot be mentioned, summarised or
 *    leaked by the model. Reaching for `BoardModel` directly here would quietly
 *    undo that.
 *  - **It is bounded.** Names and counts, not contents. The model has 40 tools
 *    for detail; this is orientation, and an unbounded context is how a prompt
 *    becomes expensive and slow at exactly the moment a workspace gets busy.
 *  - **Absence is stated.** A section that has no data says so rather than
 *    being omitted, because a missing heading invites the model to invent one.
 */
export type AssistantContext = {
  summary: string;
};

/** Caps so a large workspace cannot blow up the prompt. */
const MAX_BOARDS = 15;
const MAX_MEMBERS = 20;
const MAX_TASKS = 8;

function list(items: string[], empty: string): string {
  return items.length > 0 ? items.join("\n") : empty;
}

export async function buildAssistantContext(
  session: AuthenticatedSession,
  context: { workspaceId: string | null; boardId: string | null; pathname: string },
): Promise<AssistantContext> {
  const userId = session.user.id;
  const now = new Date();
  const memories = await recallMemories(userId, context.workspaceId);

  const lines: string[] = [
    "## Who you are talking to",
    `${session.user.name} (${session.user.email})`,
    `Account role: ${getSessionRole(session)}`,
    `Current time: ${now.toISOString()} (UTC)`,
    `Looking at: ${context.pathname}`,
  ];

  if (memories.length > 0) {
    lines.push(
      "",
      "## What you already know about them",
      "Carried over from earlier conversations. Treat as true unless they correct it — and if they do, call `forget` with the id.",
      ...memories.map(
        (memory) => `- [${memory.type}] ${memory.content} (id ${memory.id})`,
      ),
    );
  }

  if (!context.workspaceId) {
    lines.push(
      "",
      "## Workspace",
      "None active. The user has not opened a workspace yet, so you cannot answer questions about boards or tasks until they do.",
    );

    return { summary: lines.join("\n") };
  }

  // Everything below is scoped to this viewer by the services themselves.
  const [workspace, boards] = await Promise.all([
    getWorkspaceById(context.workspaceId),
    listBoards(context.workspaceId, userId),
  ]);

  const boardIds = boards.map((board) => board.id);
  const work = await getDashboardData({ userId, boardIds });

  lines.push(
    "",
    "## Current workspace",
    `${workspace.name} (id ${workspace.id})`,
    `You are ${
      workspace.createdById === userId
        ? "the person who created it"
        : workspace.managerIds.includes(userId)
          ? "a manager of it"
          : "a member of it"
    }.`,
    "",
    "### People",
    list(
      workspace.members
        .slice(0, MAX_MEMBERS)
        .map((member) => `- ${member.name} (id ${member.id})`),
      "- Nobody else is in this workspace.",
    ),
    "",
    "### Boards visible to this user",
    list(
      boards
        .slice(0, MAX_BOARDS)
        .map((board) => `- ${board.name} (id ${board.id})`),
      "- No boards yet.",
    ),
  );

  lines.push(
    "",
    "## This user's own work",
    `Overdue: ${work.overdue.length} · Due today: ${work.dueToday.length} · Open and assigned to them: ${work.assignedToMe.length} · Completed this week: ${work.completedThisWeek}`,
  );

  if (work.overdue.length > 0) {
    lines.push(
      "",
      "### Overdue",
      work.overdue
        .slice(0, MAX_TASKS)
        .map(
          (task) =>
            `- ${task.title} (id ${task.id}, ${task.priority}, due ${task.dueDate})`,
        )
        .join("\n"),
    );
  }

  if (work.dueToday.length > 0) {
    lines.push(
      "",
      "### Due today",
      work.dueToday
        .slice(0, MAX_TASKS)
        .map((task) => `- ${task.title} (id ${task.id}, ${task.priority})`)
        .join("\n"),
    );
  }

  if (context.boardId) {
    // `getBoardSnapshot` does not itself check access, so this only runs for a
    // board that already survived the `listBoards` filter above.
    const isVisible = boardIds.includes(context.boardId);

    if (isVisible) {
      const snapshot = await getBoardSnapshot(context.boardId);
      const open = snapshot.tasks.filter((task) => task.completedAt === null);

      lines.push(
        "",
        "## The board they are looking at",
        `${snapshot.board.name} (id ${snapshot.board.id}) — ${open.length} open of ${snapshot.tasks.length}`,
        "",
        "### Columns",
        list(
          snapshot.lists.map((column) => {
            const count = snapshot.tasks.filter(
              (task) => task.listId === column.id,
            ).length;

            return `- ${column.name} (id ${column.id}): ${count} ${count === 1 ? "card" : "cards"}${column.isTerminal ? " — counts as done" : ""}`;
          }),
          "- This board has no columns.",
        ),
      );
    }
  }

  return { summary: lines.join("\n") };
}
