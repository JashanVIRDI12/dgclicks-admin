import type { Board } from "@/features/tasks/types";

/** Client-safe mirror of the server's board edit rule, used only for UX. */
export function canEditBoard(
  board: Board,
  userId: string,
  isAdmin: boolean,
): boolean {
  return (
    isAdmin ||
    board.accessMode === "workspace" ||
    board.editorIds.includes(userId)
  );
}
