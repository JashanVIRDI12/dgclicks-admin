import { listActivity } from "@/features/activity/server/activity.service";
import { listAttachments } from "@/features/tasks/server/attachment.service";
import { listComments } from "@/features/tasks/server/comment.service";
import {
  assertTaskAccess,
  getTaskDetail,
} from "@/features/tasks/server/task.service";
import type { TaskWorkspace } from "@/features/tasks/types";
import { withRoute } from "@/lib/api/handler";
import { ValidationError } from "@/lib/errors";

/**
 * One task and everything the drawer renders around it.
 *
 * `assertTaskAccess` is what stops a signed-in user reading a task on a board
 * in a workspace they are not a member of — the session check `withRoute`
 * applies only proves who is asking.
 */
export const GET = withRoute({
  auth: true,
  handler: async ({ params, session }): Promise<TaskWorkspace> => {
    const { taskId } = await params;

    if (typeof taskId !== "string" || !/^[0-9a-fA-F]{24}$/.test(taskId)) {
      throw new ValidationError("Invalid task id.");
    }

    await assertTaskAccess(taskId, session.user.id);

    const [task, comments, attachments, activity] = await Promise.all([
      getTaskDetail(taskId),
      listComments(taskId),
      listAttachments(taskId),
      // `entityId` matches the task itself and anything whose context is the
      // task, so a comment being added shows up on the task's own timeline.
      listActivity({ page: 1, entityId: taskId }),
    ]);

    return { task, comments, attachments, activity: [...activity.items] };
  },
});
