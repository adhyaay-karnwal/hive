import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { parseConfig } from "../../../utils/parse-config";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const project = await db.query.projects.findFirst({
    where: { id },
  });

  if (!project) {
    return { providers: [], defaults: {} };
  }

  const config = parseConfig(project.configOverride);
  const port = config.opencodePort;

  if (!port) {
    return { providers: [], defaults: {} };
  }

  try {
    const res = await fetch(`http://localhost:${port}/config/providers`);
    const data = await res.json();
    return data;
  } catch {
    return { providers: [], defaults: {} };
  }
});
