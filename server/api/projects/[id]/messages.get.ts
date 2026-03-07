import { db } from "../../../database";
import { messages } from "../../../database/schema";
import { eq, asc, and } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const { sessionId } = getQuery(event);

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const conditions = [eq(messages.projectId, id)];
  if (sessionId) {
    conditions.push(eq(messages.sessionId, sessionId as string));
  }

  const projectMessages = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(asc(messages.createdAt));

  return projectMessages;
});
