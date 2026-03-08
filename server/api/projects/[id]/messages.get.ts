import { db } from "../../../database";
import { messages } from "../../../database/schema";
import { eq, asc, and, isNull } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  const chatId = query.chatId as string | undefined;

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const where = chatId
    ? and(eq(messages.projectId, id), eq(messages.chatId, chatId))
    : and(eq(messages.projectId, id), isNull(messages.chatId));

  const projectMessages = await db
    .select()
    .from(messages)
    .where(where)
    .orderBy(asc(messages.createdAt));

  return projectMessages;
});
