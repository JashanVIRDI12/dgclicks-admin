import { NextResponse, type NextRequest } from "next/server";

import {
  getAttachmentTaskId,
  openAttachmentStream,
} from "@/features/tasks/server/attachment.service";
import { assertTaskAccess } from "@/features/tasks/server/task.service";
import { requireSessionOrThrow } from "@/features/auth/server/session";
import { apiFail } from "@/lib/api/response";
import { ValidationError } from "@/lib/errors";

/**
 * Content types the browser may render in place.
 *
 * The stored content type is whatever the uploader's browser put in the
 * multipart part — it is attacker-controlled, so it decides nothing on its own.
 * Serving an unrecognised type `inline` is what turns an upload into a page on
 * this origin: an `.html` file, or an SVG (which carries `<script>`), would run
 * with the viewer's session cookie attached. Everything outside this list is
 * forced to download instead.
 *
 * `image/svg+xml` is deliberately absent for exactly that reason.
 */
const INLINE_SAFE_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "application/pdf",
]);

/**
 * Serves an attachment's bytes.
 *
 * Written by hand rather than through `withRoute` because that wraps its return
 * value in the JSON success envelope, and this response is the file itself.
 * The two checks `withRoute` would have applied are done explicitly: a valid
 * session, then membership of the workspace the task's board belongs to.
 *
 * This auth check is the whole reason attachments live in GridFS instead of a
 * public bucket — an unguessable object URL is not the same as a private one.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
): Promise<NextResponse> {
  try {
    const session = await requireSessionOrThrow();
    const { attachmentId } = await context.params;

    if (
      typeof attachmentId !== "string" ||
      !/^[0-9a-fA-F]{24}$/.test(attachmentId)
    ) {
      throw new ValidationError("Invalid attachment id.");
    }

    const taskId = await getAttachmentTaskId(attachmentId);
    await assertTaskAccess(taskId, session.user.id);

    const { stream, filename, contentType, length } =
      await openAttachmentStream(attachmentId);

    const disposition = INLINE_SAFE_CONTENT_TYPES.has(contentType)
      ? "inline"
      : "attachment";

    return new NextResponse(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(length),
        // `inline` only for the types above, so images and PDFs still preview;
        // anything else downloads. The quoted, escaped filename keeps a comma
        // or quote in a name from truncating the header.
        "Content-Disposition": `${disposition}; filename="${filename.replace(/["\\]/g, "_")}"`,
        // Without this a browser is free to ignore the declared type and sniff
        // the bytes instead, which would put back the exact hole the allowlist
        // above closes.
        "X-Content-Type-Options": "nosniff",
        // Private: this is behind auth, and a shared cache holding it would
        // undo that.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return apiFail(error);
  }
}
