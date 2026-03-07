import { db } from "../../../database";
import { sessions } from "../../../database/schema";
import { eq, and, desc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const projectSessions = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.projectId, id), eq(sessions.role, "main")))
    .orderBy(desc(sessions.createdAt));

  return projectSessions;
});
