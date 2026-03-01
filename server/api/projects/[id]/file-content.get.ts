import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod/v4";

const querySchema = z.object({
  path: z.string().min(1).refine((p) => !p.includes(".."), "Invalid path"),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const { path: filePath } = await getValidatedQuery(event, querySchema.parse);

  const project = await db.query.projects.findFirst({
    where: { id },
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  try {
    const fullPath = join(project.path, filePath);
    const content = await readFile(fullPath, "utf-8");
    return { content, path: filePath };
  } catch {
    throw createError({ statusCode: 404, message: "File not found" });
  }
});
