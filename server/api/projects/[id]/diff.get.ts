import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { parseConfig } from "../../../utils/parse-config";
import { z } from "zod/v4";

const querySchema = z.object({
  sessionId: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const { sessionId } = await getValidatedQuery(event, querySchema.parse);

  const project = await db.query.projects.findFirst({
    where: { id },
  });

  if (!project) {
    return [];
  }

  const config = parseConfig(project.configOverride);
  const port = config.opencodePort;

  if (!port) {
    return [];
  }

  try {
    const res = await fetch(
      `http://localhost:${port}/session/${sessionId}/diff`,
    );
    return await res.json();
  } catch {
    return [];
  }
});
