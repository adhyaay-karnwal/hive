import { db } from "../../../database";
import { sessions } from "../../../database/schema";
import { nanoid } from "nanoid";
import { z } from "zod";

const bodySchema = z.object({
  title: z.string().optional(),
  modelPreference: z.enum(["opus", "sonnet", "gemini-3.1-pro", "gemini-3-flash"]).default("sonnet"),
});

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, "id");
  if (!projectId) {
    throw createError({ statusCode: 400, message: "Project ID is required" });
  }

  const body = await readBody(event);
  const validated = bodySchema.parse(body);

  const id = nanoid();
  const [session] = await db
    .insert(sessions)
    .values({
      id,
      projectId,
      role: "main",
      title: validated.title || "New Chat",
      modelPreference: validated.modelPreference,
      status: "idle",
    })
    .returning();

  return session;
});
