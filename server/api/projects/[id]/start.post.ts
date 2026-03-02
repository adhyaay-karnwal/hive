import { db } from "../../../database";

/**
 * Validate that a project exists and is ready.
 * Previously started an OpenCode server — now just a validation endpoint.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const project = await db.query.projects.findFirst({
    where: { id },
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  return { ok: true, projectId: project.id };
});
