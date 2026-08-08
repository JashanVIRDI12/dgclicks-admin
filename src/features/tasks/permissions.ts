import type { Board, Workspace } from "@/features/tasks/types";

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

/**
 * Client-safe mirror of `assertWorkspaceManager`, used only for UX.
 *
 * Managing a workspace means changing the workspace itself — its name, its
 * people, its invite links, who else may administer it, and what boards exist
 * in it. Working *inside* one only takes membership.
 *
 * Two people are always managers whatever the stored list says: the creator, so
 * a workspace can never be left with nobody able to run it, and any global
 * administrator, so it cannot lock them out. Deleting a workspace is not here —
 * that stays with global administrators alone.
 */
export function canManageWorkspace(
  workspace: Workspace,
  userId: string,
  isAdmin: boolean,
): boolean {
  return (
    isAdmin ||
    workspace.createdById === userId ||
    workspace.managerIds.includes(userId)
  );
}
