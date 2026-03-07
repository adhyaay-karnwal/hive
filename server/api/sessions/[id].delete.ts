import { db } from "../../database";
import { sessions, messages } from "../../database/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  // Delete all messages associated with this session
  await db.delete(messages).where(eq(messages.sessionId, id));

  // Delete the session itself
  await db.delete(sessions).where(eq(sessions.id, id));

  return { ok: true };
});
