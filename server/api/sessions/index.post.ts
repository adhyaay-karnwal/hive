import { db } from "../../database";
import { sessions, worktrees } from "../../database/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod/v4";

const bodySchema = z.object({
  worktreeId: z.string().min(1),
  role: z.enum(["main", "worker", "reviewer"]),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse);

  const worktree = await db.query.worktrees.findFirst({
    where: { id: body.worktreeId },
  });

  if (!worktree || !worktree.opencodePort) {
    throw createError({
      statusCode: 400,
      message: "Worktree not found or OpenCode server not running",
    });
  }

  // Create a session on the OpenCode server
  const opencodeUrl = `http://localhost:${worktree.opencodePort}`;
  let opencodeSessionId: string | undefined;

  try {
    const res = await fetch(`${opencodeUrl}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    opencodeSessionId = data.id;
  } catch (e) {
    console.warn("Failed to create OpenCode session:", e);
    // Server might not be ready yet, we'll retry later
  }

  const id = nanoid();
  const [session] = await db
    .insert(sessions)
    .values({
      id,
      worktreeId: body.worktreeId,
      opencodeSessionId,
      role: body.role,
      status: "idle",
    })
    .returning();

  return session;
});
