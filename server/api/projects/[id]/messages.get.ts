import { db } from "../../../database";
import { messages } from "../../../database/schema";
import { eq, asc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const projectMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.projectId, id))
    .orderBy(asc(messages.createdAt));

  return projectMessages;
});
