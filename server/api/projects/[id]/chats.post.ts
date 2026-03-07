import { db } from "../../../database";
import { chats } from "../../../database/schema";
import { generateId } from "ai";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody(event);

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const { title } = body as { title: string };

  const newChat = {
    id: generateId(),
    projectId: id,
    title: title || "New Chat",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(chats).values(newChat);

  return newChat;
});
