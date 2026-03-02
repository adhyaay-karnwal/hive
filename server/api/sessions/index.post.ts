import { db } from "../../database";
import { sessions } from "../../database/schema";
import { nanoid } from "nanoid";
import { z } from "zod/v4";

const bodySchema = z.object({
  projectId: z.string().min(1),
  worktreeId: z.string().optional(),
  parentSessionId: z.string().optional(),
  role: z.enum(["main", "worker", "reviewer"]),
  modelPreference: z.enum(["opus", "sonnet"]).default("sonnet"),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse);

  const id = nanoid();
  const [session] = await db
    .insert(sessions)
    .values({
      id,
      projectId: body.projectId,
      worktreeId: body.worktreeId,
      parentSessionId: body.parentSessionId,
      role: body.role,
      modelPreference: body.modelPreference,
      status: "idle",
    })
    .returning();

  return session;
});
