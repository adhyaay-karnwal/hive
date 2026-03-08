import { db } from "../../database";
import { chats, messages } from "../../database/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  // Delete messages first due to foreign key constraints if any,
  // though drizzle with sqlite doesn't always enforce them unless pragma is on.
  await db.delete(messages).where(eq(messages.chatId, id));
  await db.delete(chats).where(eq(chats.id, id));

  return { success: true };
});
