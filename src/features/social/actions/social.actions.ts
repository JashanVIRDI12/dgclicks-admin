"use server";

import { revalidatePath } from "next/cache";

import {
  archiveClientSchema,
  createClientSchema,
  createPostSchema,
  postIdSchema,
  updatePostSchema,
} from "@/features/social/schemas/social.schema";
import {
  archiveClient,
  createClient,
  createPost,
  deletePost,
  updatePost,
} from "@/features/social/server/social.service";
import type { SocialClient, SocialPost } from "@/features/social/types";
import { createAction } from "@/lib/actions/create-action";

/**
 * Every mutation re-proves workspace membership inside the service, so these
 * stay thin: parse, call, revalidate.
 *
 * Only `/content` is revalidated. Nothing else in the app reads a post, which
 * is the point of keeping this module sealed — there is no dashboard count or
 * activity entry here to fall out of step.
 */
function revalidateContent(): void {
  revalidatePath("/content");
}

export const createClientAction = createAction({
  auth: true,
  input: createClientSchema,
  handler: async ({ input, session }): Promise<SocialClient> => {
    const client = await createClient(
      input.workspaceId,
      { name: input.name, handle: input.handle, color: input.color },
      session.user.id,
    );

    revalidateContent();
    return client;
  },
});

export const archiveClientAction = createAction({
  auth: true,
  input: archiveClientSchema,
  handler: async ({ input, session }): Promise<void> => {
    await archiveClient(input.workspaceId, input.clientId, session.user.id);
    revalidateContent();
  },
});

export const createPostAction = createAction({
  auth: true,
  input: createPostSchema,
  handler: async ({ input, session }): Promise<SocialPost> => {
    const { workspaceId, ...post } = input;
    const created = await createPost(workspaceId, post, session.user.id);

    revalidateContent();
    return created;
  },
});

export const updatePostAction = createAction({
  auth: true,
  input: updatePostSchema,
  handler: async ({ input, session }): Promise<SocialPost> => {
    const { id, ...patch } = input;
    const post = await updatePost(id, patch, session.user.id);

    revalidateContent();
    return post;
  },
});

export const deletePostAction = createAction({
  auth: true,
  input: postIdSchema,
  handler: async ({ input, session }): Promise<void> => {
    await deletePost(input.id, session.user.id);
    revalidateContent();
  },
});
