import { db } from "../../database";
import { worktrees } from "../../database/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const querySchema = z.object({
  projectId: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const { projectId } = await getValidatedQuery(event, querySchema.parse);

  return db
    .select()
    .from(worktrees)
    .where(eq(worktrees.projectId, projectId));
});
