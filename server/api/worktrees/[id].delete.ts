import { db } from "../../database";
import { worktrees } from "../../database/schema";
import { eq } from "drizzle-orm";
import { removeWorktree } from "../../services/worktree";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const worktree = await db.query.worktrees.findFirst({
    where: { id },
  });

  if (!worktree) {
    throw createError({ statusCode: 404, message: "Worktree not found" });
  }

  const project = await db.query.projects.findFirst({
    where: { id: worktree.projectId },
  });

  // Remove git worktree
  if (project) {
    try {
      await removeWorktree(project.path, worktree.path);
    } catch (e) {
      console.warn("Failed to remove git worktree:", e);
    }
  }

  // Remove from database
  await db.delete(worktrees).where(eq(worktrees.id, id));

  return { success: true };
});
