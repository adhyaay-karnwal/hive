import { db } from "../../../../database";
import { changeComments } from "../../../../database/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const bodySchema = z.object({
  content: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const commentId = getRouterParam(event, "commentId");
  if (!commentId) {
    throw createError({ statusCode: 400, message: "commentId is required" });
  }

  const body = await readValidatedBody(event, bodySchema.parse);

  const [updated] = await db
    .update(changeComments)
    .set({ content: body.content.trim() })
    .where(eq(changeComments.id, commentId))
    .returning();

  return updated;
});
