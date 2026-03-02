import { db } from "../../database";
import { signals, sessions } from "../../database/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const bodySchema = z.object({
  answer: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const body = await readValidatedBody(event, bodySchema.parse);

  const signal = await db.query.signals.findFirst({
    where: { id },
  });

  if (!signal) {
    throw createError({ statusCode: 404, message: "Signal not found" });
  }

  await db
    .update(signals)
    .set({
      resolved: true,
      resolvedContent: body.answer,
    })
    .where(eq(signals.id, id));

  if (signal.sessionId) {
    await db
      .update(sessions)
      .set({ status: "working" })
      .where(eq(sessions.id, signal.sessionId));
  }

  return { success: true };
});
