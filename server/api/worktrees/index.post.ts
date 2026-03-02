import { db } from "../../database";
import { worktrees, projects } from "../../database/schema";
import { nanoid } from "nanoid";
import { createWorktree } from "../../services/worktree";
import { installDeps } from "../../services/worktree";
import { z } from "zod/v4";

const bodySchema = z.object({
  projectId: z.string().min(1),
  branchName: z.string().min(1),
  linearIssueId: z.string().optional(),
  linearIssueIdentifier: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse);

  // Get the project
  const project = await db.query.projects.findFirst({
    where: { id: body.projectId },
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  // Create git worktree
  const worktreePath = await createWorktree(project.path, body.branchName);

  const id = nanoid();

  // Save to database
  const [worktree] = await db
    .insert(worktrees)
    .values({
      id,
      projectId: body.projectId,
      branchName: body.branchName,
      path: worktreePath,
      status: "active",
      linearIssueId: body.linearIssueId,
      linearIssueIdentifier: body.linearIssueIdentifier,
    })
    .returning();

  // Install dependencies in the background
  if (project.installCommand) {
    installDeps(worktreePath, project.installCommand).then((result) => {
      if (result.success) {
        console.log(`[worktree:${body.branchName}] Dependencies installed`);
      } else {
        console.error(
          `[worktree:${body.branchName}] Install failed:`,
          result.output,
        );
      }
    });
  }

  return worktree;
});
