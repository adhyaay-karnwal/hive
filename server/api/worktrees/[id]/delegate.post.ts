import { db } from "../../../database";
import { sessions, worktrees } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { buildWorkerPrompt } from "../../../services/prompt-builder";
import { z } from "zod/v4";

const bodySchema = z.object({
  taskDescription: z.string().min(1),
  linearIssueDescription: z.string().optional(),
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

  if (!worktree?.opencodePort) {
    throw createError({
      statusCode: 400,
      message: "Worktree not found or OpenCode server not running",
    });
  }

  const port = worktree.opencodePort;

  // Find or create a worker session
  let session = await db.query.sessions.findFirst({
    where: { worktreeId: id },
  });

  if (!session) {
    let opencodeSessionId: string | undefined;
    try {
      const res = await fetch(`http://localhost:${port}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      opencodeSessionId = data.id;
    } catch {
      // server might not be ready
    }

    const sessionId = nanoid();
    const [newSession] = await db
      .insert(sessions)
      .values({
        id: sessionId,
        worktreeId: id,
        opencodeSessionId,
        role: "worker",
        status: "working",
      })
      .returning();
    session = newSession;
  }

  // Build the prompt with developer profile and skills injected
  const prompt = await buildWorkerPrompt({
    taskDescription: body.taskDescription,
    linearIssueDescription: body.linearIssueDescription,
    worktreeId: id,
  });

  // Send to OpenCode
  if (session.opencodeSessionId) {
    try {
      await fetch(
        `http://localhost:${port}/session/${session.opencodeSessionId}/prompt_async`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parts: [{ type: "text", text: prompt }],
          }),
        },
      );

      await db
        .update(sessions)
        .set({ status: "working" })
        .where(eq(sessions.id, session.id));
    } catch (e) {
      throw createError({
        statusCode: 500,
        message: "Failed to send task to OpenCode",
      });
    }
  }

  return { success: true, sessionId: session.id };
});
