import { db } from "../../../database";
import { messages } from "../../../database/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  await db.delete(messages).where(eq(messages.projectId, id));

  return { success: true };
});
