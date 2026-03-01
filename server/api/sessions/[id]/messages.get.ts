import { db } from "../../../database";
import { sessions, worktrees } from "../../../database/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const session = await db.query.sessions.findFirst({
    where: { id },
  });

  if (!session) {
    throw createError({ statusCode: 404, message: "Session not found" });
  }

  const worktree = await db.query.worktrees.findFirst({
    where: { id: session.worktreeId! },
  });

  if (!worktree?.opencodePort || !session.opencodeSessionId) {
    return [];
  }

  const opencodeUrl = `http://localhost:${worktree.opencodePort}`;

  try {
    const res = await fetch(
      `${opencodeUrl}/session/${session.opencodeSessionId}/message`,
    );
    return await res.json();
  } catch {
    return [];
  }
});
