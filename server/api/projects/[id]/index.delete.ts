import { db } from "../../../database";
import { projects, worktrees, sessions, signals, reviews, reviewComments } from "../../../database/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  // Clean up child records to avoid FK constraint failures
  const wts = await db
    .select()
    .from(worktrees)
    .where(eq(worktrees.projectId, id));

  for (const wt of wts) {
    const wtSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.worktreeId, wt.id));

    for (const sess of wtSessions) {
      await db.delete(signals).where(eq(signals.sessionId, sess.id));
    }
    await db.delete(sessions).where(eq(sessions.worktreeId, wt.id));

    const wtReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.worktreeId, wt.id));

    for (const rev of wtReviews) {
      await db.delete(reviewComments).where(eq(reviewComments.reviewId, rev.id));
    }
    await db.delete(reviews).where(eq(reviews.worktreeId, wt.id));
  }

  // Also clean up sessions that reference the project directly (not via worktree)
  const projectSessions = await db
    .select()
    .from(sessions)
    .where(eq(sessions.projectId, id));

  for (const sess of projectSessions) {
    await db.delete(signals).where(eq(signals.sessionId, sess.id));
  }
  await db.delete(sessions).where(eq(sessions.projectId, id));

  await db.delete(worktrees).where(eq(worktrees.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));

  return { success: true };
});
