import { db } from "../../../database";
import { reviews, worktrees } from "../../../database/schema";
import { eq } from "drizzle-orm";
import simpleGit from "simple-git";
import { z } from "zod/v4";

const bodySchema = z.object({
  commitMessage: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readValidatedBody(event, bodySchema.parse);

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const review = await db.query.reviews.findFirst({
    where: { id },
  });

  if (!review) {
    throw createError({ statusCode: 404, message: "Review not found" });
  }

  // Mark as approved
  await db
    .update(reviews)
    .set({ status: "approved" })
    .where(eq(reviews.id, id));

  // If commit message provided, commit the changes
  if (body.commitMessage) {
    const worktree = await db.query.worktrees.findFirst({
      where: { id: review.worktreeId },
    });

    if (worktree) {
      try {
        const git = simpleGit(worktree.path);
        await git.add(".");
        await git.commit(body.commitMessage);
      } catch (e: any) {
        console.error("Failed to commit:", e);
      }
    }
  }

  return { success: true };
});
