import { db } from "../../database";
import { signals, sessions } from "../../database/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod/v4";

const bodySchema = z.object({
  type: z.enum(["question", "done", "progress", "error", "blocked"]),
  content: z.string().min(1),
  options: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse);

  const signalId = nanoid();

  // Create the signal record
  const [signal] = await db
    .insert(signals)
    .values({
      id: signalId,
      sessionId: body.sessionId || "unknown",
      type: body.type,
      content: body.content,
      options: body.options ? body.options : null,
      resolved: false,
    })
    .returning();

  // Update session status based on signal type
  if (body.sessionId) {
    const statusMap: Record<string, string> = {
      question: "question",
      done: "done",
      progress: "working",
      error: "error",
      blocked: "question",
    };
    await db
      .update(sessions)
      .set({ status: statusMap[body.type] || "working" })
      .where(eq(sessions.id, body.sessionId));
  }

  // For questions, long-poll until resolved
  if (body.type === "question" || body.type === "blocked") {
    const answer = await waitForResolution(signalId, 300_000); // 5 min timeout
    return { answer };
  }

  // For non-blocking signals, return immediately
  return { success: true, signalId };
});

/**
 * Poll the database until the signal is resolved or timeout.
 */
async function waitForResolution(
  signalId: string,
  timeoutMs: number,
): Promise<string> {
  const start = Date.now();
  const pollInterval = 1000; // 1 second

  while (Date.now() - start < timeoutMs) {
    const signal = await db.query.signals.findFirst({
      where: { id: signalId, resolved: true },
    });

    if (signal?.resolvedContent) {
      return signal.resolvedContent;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return "No answer provided (timeout).";
}
