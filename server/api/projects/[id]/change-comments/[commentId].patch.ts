import { db } from "../../../../database";
import { changeComments } from "../../../../database/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const commentId = getRouterParam(event, "commentId");
  if (!commentId) {
    throw createError({ statusCode: 400, message: "commentId is required" });
  }

  const body = await readBody<{ content: string }>(event);
  if (!body.content?.trim()) {
    throw createError({ statusCode: 400, message: "content is required" });
  }

  const [updated] = await db
    .update(changeComments)
    .set({ content: body.content.trim() })
    .where(eq(changeComments.id, commentId))
    .returning();

  return updated;
});
