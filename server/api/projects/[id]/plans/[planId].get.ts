import { db } from "../../../../database";
import { plans } from "../../../../database/schema";

import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, "id");
  const planId = getRouterParam(event, "planId");

  if (!projectId || !planId) {
    throw createError({ statusCode: 400, message: "Project ID and Plan ID are required" });
  }

  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, planId),
  });

  if (!plan) {
    throw createError({ statusCode: 404, message: "Plan not found" });
  }

  // Verify the plan belongs to the project
  if (plan.projectId !== projectId) {
    throw createError({ statusCode: 403, message: "Plan does not belong to this project" });
  }

  return plan;
});
