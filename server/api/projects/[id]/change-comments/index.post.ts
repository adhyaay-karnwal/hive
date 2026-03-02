import { db } from "../../../../database";
import { changeComments } from "../../../../database/schema";
import { nanoid } from "nanoid";
import { z } from "zod/v4";

const bodySchema = z.object({
  filePath: z.string().min(1),
  startLine: z.number(),
  endLine: z.number(),
  side: z.enum(["additions", "deletions"]).optional(),
  content: z.string().min(1),
  sessionId: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const body = await readValidatedBody(event, bodySchema.parse);

  const [comment] = await db
    .insert(changeComments)
    .values({
      id: nanoid(),
      projectId: id,
      sessionId: body.sessionId || null,
      filePath: body.filePath,
      startLine: body.startLine,
      endLine: body.endLine,
      side: body.side || null,
      content: body.content,
    })
    .returning();

  return comment;
});
