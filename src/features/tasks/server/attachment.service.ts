import "server-only";

import { GridFSBucket, type ObjectId } from "mongodb";
import { Types } from "mongoose";

import { LIMITS } from "@/features/tasks/constants";
import {
  AttachmentModel,
  TaskModel,
  type AttachmentDoc,
} from "@/features/tasks/server/models";
import { ATTACHMENT_POPULATE } from "@/features/tasks/server/populate";
import { toAttachment } from "@/features/tasks/server/serialize";
import type { Attachment } from "@/features/tasks/types";
import { mongoDb } from "@/lib/db/client";
import { connectToDatabase } from "@/lib/db/connect";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

/**
 * File storage on the cluster this app already connects to.
 *
 * GridFS rather than an object store because attachments here are internal work
 * product: a bucket URL is readable by anyone who has it, whereas every read
 * through this path goes via a route handler that checks the session first.
 * It also means no second provider, no extra credentials, and no third service
 * to be down.
 */
const BUCKET_NAME = "attachment_files";

function bucket(): GridFSBucket {
  return new GridFSBucket(mongoDb, { bucketName: BUCKET_NAME });
}

export async function listAttachments(taskId: string): Promise<Attachment[]> {
  await connectToDatabase();

  const docs = await AttachmentModel.find({ task: taskId })
    .populate(ATTACHMENT_POPULATE)
    .sort({ createdAt: 1 })
    .lean<AttachmentDoc[]>();

  return docs.map(toAttachment);
}

export async function getAttachmentById(id: string): Promise<Attachment> {
  await connectToDatabase();

  const doc = await AttachmentModel.findById(id)
    .populate(ATTACHMENT_POPULATE)
    .lean<AttachmentDoc>();

  if (!doc) {
    throw new NotFoundError("That attachment no longer exists.");
  }

  return toAttachment(doc);
}

/** The task an attachment hangs off, for the access check before a download. */
export async function getAttachmentTaskId(id: string): Promise<string> {
  await connectToDatabase();

  const doc = await AttachmentModel.findById(id)
    .select("task")
    .lean<{ task: Types.ObjectId }>();

  if (!doc) {
    throw new NotFoundError("That attachment no longer exists.");
  }

  return doc.task.toString();
}

/**
 * Streams an upload into GridFS, then records it.
 *
 * The metadata document is written last so a failed or aborted upload leaves an
 * orphaned blob rather than an attachment row pointing at a file that does not
 * exist — the first is invisible, the second is a broken download link.
 */
export async function createAttachment(
  input: { taskId: string; file: File },
  uploadedById: string,
): Promise<Attachment> {
  await connectToDatabase();

  if (input.file.size === 0) {
    throw new ValidationError("That file is empty.");
  }

  if (input.file.size > LIMITS.attachmentBytes) {
    throw new ValidationError(
      `Files must be under ${Math.round(LIMITS.attachmentBytes / 1024 / 1024)} MB.`,
    );
  }

  const existing = await AttachmentModel.countDocuments({ task: input.taskId });

  if (existing >= LIMITS.attachmentsPerTask) {
    throw new ConflictError(
      `A task can hold at most ${LIMITS.attachmentsPerTask} attachments.`,
    );
  }

  const filename = input.file.name.slice(0, 260) || "attachment";
  const contentType = input.file.type || "application/octet-stream";

  // The driver dropped the top-level `contentType` option; it lives in metadata
  // now. The authoritative copy is on the Attachment record either way — that is
  // what the download route sets the response header from.
  const uploadStream = bucket().openUploadStream(filename, {
    metadata: { contentType },
  });

  await input.file.stream().pipeTo(
    new WritableStream({
      write(chunk) {
        return new Promise((resolve, reject) => {
          uploadStream.write(chunk, (error) =>
            error ? reject(error) : resolve(),
          );
        });
      },
      close() {
        return new Promise((resolve, reject) => {
          uploadStream.end(() => resolve());
          uploadStream.once("error", reject);
        });
      },
      abort(reason) {
        uploadStream.destroy(reason as Error);
      },
    }),
  );

  const created = await AttachmentModel.create({
    task: new Types.ObjectId(input.taskId),
    filename,
    contentType,
    size: input.file.size,
    gridFsId: uploadStream.id,
    uploadedBy: new Types.ObjectId(uploadedById),
  });

  await TaskModel.findByIdAndUpdate(input.taskId, {
    $inc: { attachmentCount: 1 },
  });

  return getAttachmentById(created._id.toString());
}

/**
 * The bytes, for the download route.
 *
 * `Content-Length` comes from the stored file rather than the attachment record
 * so the header can never promise more bytes than the bucket actually holds.
 */
export async function openAttachmentStream(id: string): Promise<{
  filename: string;
  contentType: string;
  length: number;
  stream: ReadableStream<Uint8Array>;
}> {
  await connectToDatabase();

  const attachment = await AttachmentModel.findById(id).lean<AttachmentDoc>();

  if (!attachment) {
    throw new NotFoundError("That attachment no longer exists.");
  }

  const files = await bucket()
    .find({ _id: attachment.gridFsId as unknown as ObjectId })
    .limit(1)
    .toArray();

  const file = files[0];

  if (!file) {
    throw new NotFoundError("That file is no longer stored.");
  }

  const download = bucket().openDownloadStream(
    attachment.gridFsId as unknown as ObjectId,
  );

  return {
    filename: attachment.filename,
    contentType: attachment.contentType,
    length: file.length,
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        download.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        download.on("end", () => controller.close());
        download.on("error", (error) => controller.error(error));
      },
      cancel() {
        download.destroy();
      },
    }),
  };
}

export async function deleteAttachment(id: string): Promise<Attachment> {
  await connectToDatabase();

  const deleted = await AttachmentModel.findByIdAndDelete(id)
    .populate(ATTACHMENT_POPULATE)
    .lean<AttachmentDoc>();

  if (!deleted) {
    throw new NotFoundError("That attachment no longer exists.");
  }

  // The blob goes after the record. If this throws, the file is orphaned but
  // nothing in the UI points at it; the reverse would leave a visible download
  // that 404s.
  await bucket().delete(deleted.gridFsId as unknown as ObjectId);

  await TaskModel.findOneAndUpdate(
    { _id: deleted.task, attachmentCount: { $gt: 0 } },
    { $inc: { attachmentCount: -1 } },
  );

  return toAttachment(deleted);
}

/**
 * Removes every attachment owned by a set of tasks, including its GridFS data.
 *
 * Cascading board/workspace deletion cannot call `deleteAttachment` one row at
 * a time: besides being needlessly slow, that function also updates task
 * counters on tasks that are about to disappear. This bulk path removes the
 * metadata first, then the now-unreachable file and chunk records.
 */
export async function deleteAttachmentsForTasks(
  taskIds: readonly Types.ObjectId[],
): Promise<void> {
  if (taskIds.length === 0) {
    return;
  }

  await connectToDatabase();

  const attachments = await AttachmentModel.find({ task: { $in: taskIds } })
    .select("gridFsId")
    .lean<{ gridFsId: Types.ObjectId }[]>();

  await AttachmentModel.deleteMany({ task: { $in: taskIds } });

  if (attachments.length === 0) {
    return;
  }

  const fileIds = attachments.map(
    (attachment) => attachment.gridFsId as unknown as ObjectId,
  );

  await Promise.all([
    mongoDb
      .collection(`${BUCKET_NAME}.chunks`)
      .deleteMany({ files_id: { $in: fileIds } }),
    mongoDb
      .collection(`${BUCKET_NAME}.files`)
      .deleteMany({ _id: { $in: fileIds } }),
  ]);
}
