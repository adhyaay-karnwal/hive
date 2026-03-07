import { db } from "../../../database";
import { messages } from "../../../database/schema";
import { eq, and } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const { sessionId } = getQuery(event);

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  if (sessionId) {
    await db.delete(messages).where(and(eq(messages.projectId, id), eq(messages.sessionId, sessionId as string)));
  } else {
    await db.delete(messages).where(eq(messages.projectId, id));
  }

  return { success: true };
});
