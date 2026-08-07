import { z } from "zod";

import { getActiveWorkspaceContext } from "@/features/tasks/server/active-workspace";
import { listBoards } from "@/features/tasks/server/board.service";
import { searchTasks } from "@/features/tasks/server/task.service";
import type { Task } from "@/features/tasks/types";
import { withRoute } from "@/lib/api/handler";

/**
 * Task search for the command palette.
 *
 * Scoped to the caller's active workspace and then to the boards inside it, so
 * the result set can only ever contain tasks they already have access to — the
 * search itself is never the thing that decides what is visible.
 */
export const GET = withRoute({
  auth: true,
  from: "query",
  input: z.object({ q: z.string().max(200).default("") }),
  handler: async ({ input, session }): Promise<Task[]> => {
    const { active } = await getActiveWorkspaceContext(session.user.id);

    if (!active) {
      return [];
    }

    const boards = await listBoards(active.id, session.user.id);

    return searchTasks({
      query: input.q,
      boardIds: boards.map((board) => board.id),
    });
  },
});
