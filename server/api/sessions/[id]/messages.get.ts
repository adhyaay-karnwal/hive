import { db } from "../../../database";
import { messages } from "../../../database/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const sessionMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, id));

  return sessionMessages;
});
