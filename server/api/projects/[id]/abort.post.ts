import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { parseConfig } from "../../../utils/parse-config";
import { z } from "zod/v4";

const bodySchema = z.object({
  sessionId: z.string().min(1),
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
    throw createError({ statusCode: 400, message: "OpenCode server not running" });
  }

  const url = `http://localhost:${port}/session/${body.sessionId}/abort`;
  console.log(`[hive:abort] POST ${url}`);

  try {
    const res = await fetch(url, { method: "POST" });
    const data = await res.json();
    console.log(`[hive:abort] Response:`, data);
    return { success: true };
  } catch (e: any) {
    console.error(`[hive:abort] Failed:`, e.message);
    throw createError({ statusCode: 500, message: "Failed to abort session" });
  }
});
