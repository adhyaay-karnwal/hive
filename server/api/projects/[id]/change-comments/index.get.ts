import { db } from "../../../../database";
import { changeComments } from "../../../../database/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";

const querySchema = z.object({
  resolved: z.enum(["true", "false"]).optional(),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const { resolved: resolvedFilter } = await getValidatedQuery(event, querySchema.parse);

  const conditions = [eq(changeComments.projectId, id)];

  if (resolvedFilter === "false") {
    conditions.push(eq(changeComments.resolved, false));
  } else if (resolvedFilter === "true") {
    conditions.push(eq(changeComments.resolved, true));
  }

  const comments = await db
    .select()
    .from(changeComments)
    .where(and(...conditions))
    .orderBy(changeComments.createdAt);

  return comments;
});
