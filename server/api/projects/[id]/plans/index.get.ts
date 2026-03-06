import { db } from "../../../../database";
import { plans } from "../../../../database/schema";

import { eq, asc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, "id");

  if (!projectId) {
    throw createError({ statusCode: 400, message: "Project ID is required" });
  }

  const projectPlans = await db
    .select()
    .from(plans)
    .where(eq(plans.projectId, projectId))
    .orderBy(asc(plans.createdAt));

  return projectPlans;
});
