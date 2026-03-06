import { db } from "../../../../database";
import { projects, plans } from "../../../../database/schema";

import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { generateId } from "ai";

const createPlanSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  status: z.enum(["draft", "approved", "rejected", "executed"]).optional().default("draft"),
});

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, "id");

  if (!projectId) {
    throw createError({ statusCode: 400, message: "Project ID is required" });
  }

  const body = await readValidatedBody(event, createPlanSchema.parse);

  // Verify project exists
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const newPlan = await db.insert(plans).values({
    id: generateId(),
    projectId,
    title: body.title,
    content: body.content,
    status: body.status,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return newPlan[0];
});
