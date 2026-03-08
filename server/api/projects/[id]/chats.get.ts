import { db } from "../../../database";
import { chats } from "../../../database/schema";
import { eq, desc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const projectChats = await db
    .select()
    .from(chats)
    .where(eq(chats.projectId, id))
    .orderBy(desc(chats.createdAt));

  return projectChats;
});
