import { db } from "../../../database";
import { messages } from "../../../database/schema";
import { eq, and, isNull } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  const chatId = query.chatId as string | undefined;

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  if (chatId) {
    await db.delete(messages).where(and(eq(messages.projectId, id), eq(messages.chatId, chatId)));
  } else {
    await db.delete(messages).where(and(eq(messages.projectId, id), isNull(messages.chatId)));
  }

  return { success: true };
});
