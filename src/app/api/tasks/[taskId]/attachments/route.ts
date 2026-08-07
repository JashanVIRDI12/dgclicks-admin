import { createAttachment } from "@/features/tasks/server/attachment.service";
import { assertTaskEditAccess } from "@/features/tasks/server/task.service";
import type { Attachment } from "@/features/tasks/types";
import { withRoute } from "@/lib/api/handler";
import { ValidationError } from "@/lib/errors";

/**
 * Uploads a file to a task.
 *
 * A route handler rather than a server action because the body is multipart and
 * the file is streamed straight into GridFS — a server action would buffer the
 * whole thing through the action payload first.
 */
export const POST = withRoute({
  auth: true,
  handler: async ({ request, params, session }): Promise<Attachment> => {
    const { taskId } = await params;

    if (typeof taskId !== "string" || !/^[0-9a-fA-F]{24}$/.test(taskId)) {
      throw new ValidationError("Invalid task id.");
    }

    await assertTaskEditAccess(taskId, session.user.id);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ValidationError("Choose a file to upload.");
    }

    return createAttachment({ taskId, file }, session.user.id);
  },
});
