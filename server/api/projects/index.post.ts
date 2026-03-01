import { db } from "../../database";
import { projects } from "../../database/schema";
import { detectProject } from "../../services/detector";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod/v4";

const bodySchema = z.object({
  path: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse);

  // Check if project with this path already exists
  const existing = await db.query.projects.findFirst({
    where: { path: body.path },
  });

  if (existing) {
    // Return existing project instead of creating duplicate
    return existing;
  }

  const info = detectProject(body.path);
  const id = nanoid();

  const [project] = await db
    .insert(projects)
    .values({
      id,
      name: info.name,
      path: body.path,
      pkgManager: info.pkgManager,
      devCommand: info.devCommand,
      installCommand: info.installCommand,
    })
    .returning();

  return project;
});
