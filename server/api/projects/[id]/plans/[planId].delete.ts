import { db } from "../../../../database";
import { plans } from "../../../../database/schema";

import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, "id");
  const planId = getRouterParam(event, "planId");

  if (!projectId || !planId) {
    throw createError({ statusCode: 400, message: "Project ID and Plan ID are required" });
  }

  // Check if plan exists
  const existingPlan = await db.query.plans.findFirst({
    where: eq(plans.id, planId),
  });

  if (!existingPlan) {
    throw createError({ statusCode: 404, message: "Plan not found" });
  }

  // Verify the plan belongs to the project
  if (existingPlan.projectId !== projectId) {
    throw createError({ statusCode: 403, message: "Plan does not belong to this project" });
  }

  await db.delete(plans).where(eq(plans.id, planId));

  return { success: true };
});
