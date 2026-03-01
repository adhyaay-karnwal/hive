import { db } from "../../../database";
import { reviewComments } from "../../../database/schema";
import { nanoid } from "nanoid";
import { z } from "zod/v4";

const bodySchema = z.object({
  filePath: z.string().min(1),
  lineNumber: z.number().optional(),
  side: z.enum(["left", "right"]).optional(),
  author: z.enum(["user", "worker", "reviewer"]),
  content: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const reviewId = getRouterParam(event, "id");

  if (!reviewId) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const body = await readValidatedBody(event, bodySchema.parse);

  const [comment] = await db
    .insert(reviewComments)
    .values({
      id: nanoid(),
      reviewId,
      filePath: body.filePath,
      lineNumber: body.lineNumber,
      side: body.side,
      author: body.author,
      content: body.content,
    })
    .returning();

  return comment;
});
