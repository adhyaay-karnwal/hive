import { db } from "../../database";
import { reviews, reviewComments, worktrees } from "../../database/schema";
import { eq, desc } from "drizzle-orm";
import simpleGit from "simple-git";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const review = await db.query.reviews.findFirst({
    where: { id },
  });

  if (!review) {
    throw createError({ statusCode: 404, message: "Review not found" });
  }

  // Get comments
  const comments = await db
    .select()
    .from(reviewComments)
    .where(eq(reviewComments.reviewId, id))
    .orderBy(desc(reviewComments.createdAt));

  // Get diff from worktree
  const worktree = await db.query.worktrees.findFirst({
    where: { id: review.worktreeId },
  });

  let diff = "";
  let changedFiles: string[] = [];

  if (worktree) {
    try {
      const git = simpleGit(worktree.path);
      // Get diff against the base branch (usually main)
      diff = await git.diff(["HEAD~1..HEAD"]);
      const statusResult = await git.status();
      changedFiles = [
        ...statusResult.modified,
        ...statusResult.created,
        ...statusResult.deleted,
      ];
    } catch {
      // Might not have commits yet
      try {
        const git = simpleGit(worktree.path);
        diff = await git.diff();
        const statusResult = await git.status();
        changedFiles = [
          ...statusResult.modified,
          ...statusResult.not_added,
        ];
      } catch {
        // ignore
      }
    }
  }

  return {
    ...review,
    comments,
    diff,
    changedFiles,
  };
});
