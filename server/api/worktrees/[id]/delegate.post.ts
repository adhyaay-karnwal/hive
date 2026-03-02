import { db } from "../../../database";
import { sessions, worktrees } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { buildWorkerPrompt } from "../../../services/prompt-builder";
import { runAgent } from "../../../services/agent";
import { z } from "zod/v4";

const bodySchema = z.object({
  taskDescription: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const body = await readValidatedBody(event, bodySchema.parse);

  const worktree = await db.query.worktrees.findFirst({
    where: { id },
  });

  if (!worktree) {
    throw createError({
      statusCode: 404,
      message: "Worktree not found",
    });
  }

  // Create a worker session
  const sessionId = nanoid();
  await db.insert(sessions).values({
    id: sessionId,
    projectId: worktree.projectId,
    worktreeId: id,
    role: "worker",
    status: "working",
  });

  // Build the prompt with developer profile and skills injected
  const prompt = await buildWorkerPrompt({
    taskDescription: body.taskDescription,
    worktreeId: id,
  });

  // Run the agent in the background
  runAgent({
    messages: [{ role: "user", content: prompt }],
    projectPath: worktree.path,
    modelPreference: "sonnet",
    systemPrompt: prompt,
  })
    .then(async (result) => {
      await result.text;
      await db
        .update(sessions)
        .set({ status: "done" })
        .where(eq(sessions.id, sessionId));
    })
    .catch(async (e) => {
      console.error("[delegate] Agent failed:", e);
      await db
        .update(sessions)
        .set({ status: "error" })
        .where(eq(sessions.id, sessionId));
    });

  return { success: true, sessionId };
});
