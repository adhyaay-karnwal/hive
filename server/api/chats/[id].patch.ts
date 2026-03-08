import { db } from "../../database";
import { chats } from "../../database/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const body = await readBody(event);

  if (!body.title || typeof body.title !== "string") {
    throw createError({ statusCode: 400, message: "title is required" });
  }

  await db.update(chats).set({ title: body.title }).where(eq(chats.id, id));

  return { success: true };
});
