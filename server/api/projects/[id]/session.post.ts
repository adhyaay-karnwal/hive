import { db } from "../../../database";

/**
 * Create or reconnect a Hive session for a project.
 * Previously proxied to an OpenCode server — now just validates the project.
 * Session state is managed client-side by the AI SDK's useChat.
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
