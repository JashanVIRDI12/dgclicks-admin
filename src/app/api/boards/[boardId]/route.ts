import {
  assertBoardAccess,
  getBoardSnapshot,
} from "@/features/tasks/server/board.service";
import type { BoardSnapshot } from "@/features/tasks/types";
import { withRoute } from "@/lib/api/handler";
import { ValidationError } from "@/lib/errors";

/**
 * One board and everything on it.
 *
 * A route handler rather than a server-rendered payload because the board is a
 * TanStack Query resource: every drag, edit and comment writes optimistically
 * into this cache and then revalidates against it. `withRoute` applies the
 * session check; `assertBoardAccess` applies the workspace one.
 */
export const GET = withRoute({
  auth: true,
  handler: async ({ params, session }): Promise<BoardSnapshot> => {
    const { boardId } = await params;

    if (typeof boardId !== "string" || !/^[0-9a-fA-F]{24}$/.test(boardId)) {
      throw new ValidationError("Invalid board id.");
    }

    await assertBoardAccess(boardId, session.user.id);

    return getBoardSnapshot(boardId);
  },
});
