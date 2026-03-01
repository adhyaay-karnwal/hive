import { db } from "../../database";
import { signals } from "../../database/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod/v4";

const querySchema = z.object({
  pending: z.enum(["true", "false"]).optional(),
});

export default defineEventHandler(async (event) => {
  const { pending: pendingParam } = await getValidatedQuery(event, querySchema.parse);
  const pending = pendingParam === "true";

  if (pending) {
    return db
      .select()
      .from(signals)
      .where(eq(signals.resolved, false))
      .orderBy(desc(signals.createdAt));
  }

  return db.select().from(signals).orderBy(desc(signals.createdAt)).limit(50);
});
