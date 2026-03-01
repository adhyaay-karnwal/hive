import { db } from "../../database";
import { reviews } from "../../database/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod/v4";

const querySchema = z.object({
  worktreeId: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const { worktreeId } = await getValidatedQuery(event, querySchema.parse);

  if (worktreeId) {
    return db
      .select()
      .from(reviews)
      .where(eq(reviews.worktreeId, worktreeId))
      .orderBy(desc(reviews.createdAt));
  }

  return db.select().from(reviews).orderBy(desc(reviews.createdAt)).limit(20);
});
