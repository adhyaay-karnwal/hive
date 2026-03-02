import { db } from "../../../database";
import { sessions } from "../../../database/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  // Get all sessions for this project
  const projectSessions = await db
    .select()
    .from(sessions)
    .where(eq(sessions.projectId, id));

  if (!projectSessions.length) {
    return { status: "idle" };
  }

  // If any session is working, the project is working
  const working = projectSessions.find((s) => s.status === "working");
  if (working) {
    return { status: "working", sessionId: working.id };
  }

  // If any session has a question, surface that
  const question = projectSessions.find((s) => s.status === "question");
  if (question) {
    return { status: "question", sessionId: question.id };
  }

  // If any session errored, surface that
  const errored = projectSessions.find((s) => s.status === "error");
  if (errored) {
    return { status: "error", sessionId: errored.id };
  }

  return { status: "idle" };
});
