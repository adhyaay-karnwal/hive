import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import simpleGit from "simple-git";

/**
 * Stage all changes and commit with the provided message.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const body = await readBody<{ message: string }>(event);
  if (!body.message?.trim()) {
    throw createError({ statusCode: 400, message: "Commit message is required" });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const git = simpleGit(project.path);

  try {
    // Stage everything
    await git.add("-A");

    // Check if there's anything to commit
    const status = await git.status();
    if (status.staged.length === 0 && status.created.length === 0 && status.deleted.length === 0 && status.modified.length === 0) {
      throw createError({ statusCode: 400, message: "Nothing to commit" });
    }

    // Commit
    const result = await git.commit(body.message.trim());

    console.log(`[commit] project=${id} hash=${result.commit} summary=${result.summary.changes} files changed`);

    return {
      hash: result.commit,
      message: body.message.trim(),
      summary: result.summary,
    };
  } catch (e: any) {
    if (e.statusCode) throw e;
    console.error(`[commit] Failed for project ${id}:`, e.message);
    throw createError({ statusCode: 500, message: e.message || "Failed to commit" });
  }
});
