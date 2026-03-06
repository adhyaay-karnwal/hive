import { db } from "../../../../database";
import { plans } from "../../../../database/schema";

import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const updatePlanSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  status: z.enum(["draft", "approved", "rejected", "executed"]).optional(),
});

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, "id");
  const planId = getRouterParam(event, "planId");

  if (!projectId || !planId) {
    throw createError({ statusCode: 400, message: "Project ID and Plan ID are required" });
  }

  const body = await readValidatedBody(event, updatePlanSchema.parse);

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

  const updatedPlan = await db
    .update(plans)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(plans.id, planId))
    .returning();

  return updatedPlan[0];
});
