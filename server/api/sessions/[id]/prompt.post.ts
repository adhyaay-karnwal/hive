import { db } from "../../../database";
import { sessions, worktrees } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const bodySchema = z.object({
  message: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const body = await readValidatedBody(event, bodySchema.parse);

  const session = await db.query.sessions.findFirst({
    where: { id },
  });

  if (!session) {
    throw createError({ statusCode: 404, message: "Session not found" });
  }

  const worktree = await db.query.worktrees.findFirst({
    where: { id: session.worktreeId! },
  });

  if (!worktree?.opencodePort) {
    throw createError({
      statusCode: 400,
      message: "OpenCode server not available",
    });
  }

  const opencodeUrl = `http://localhost:${worktree.opencodePort}`;

  // Update session status
  await db
    .update(sessions)
    .set({ status: "working" })
    .where(eq(sessions.id, id));

  // Send prompt asynchronously to OpenCode
  try {
    await fetch(
      `${opencodeUrl}/session/${session.opencodeSessionId}/prompt_async`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parts: [{ type: "text", text: body.message }],
        }),
      },
    );
  } catch (e) {
    await db
      .update(sessions)
      .set({ status: "error" })
      .where(eq(sessions.id, id));
    throw createError({
      statusCode: 500,
      message: "Failed to send prompt to OpenCode",
    });
  }

  return { success: true };
});
