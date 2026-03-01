import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { parseConfig } from "../../../utils/parse-config";
import { z } from "zod/v4";

const bodySchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const body = await readValidatedBody(event, bodySchema.parse);

  const project = await db.query.projects.findFirst({
    where: { id },
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const config = parseConfig(project.configOverride);
  const port = config.opencodePort;

  if (!port) {
    throw createError({
      statusCode: 400,
      message: "OpenCode server not running",
    });
  }

  try {
    await fetch(
      `http://localhost:${port}/session/${body.sessionId}/prompt_async`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parts: [{ type: "text", text: body.message }],
        }),
      },
    );
    return { success: true };
  } catch {
    throw createError({
      statusCode: 500,
      message: "Failed to send prompt to OpenCode",
    });
  }
});
