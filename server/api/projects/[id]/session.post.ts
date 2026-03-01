import { db } from "../../../database";
import { projects } from "../../../database/schema";
import { eq } from "drizzle-orm";
import { parseConfig } from "../../../utils/parse-config";
import { z } from "zod/v4";

const bodySchema = z.object({
  forceNew: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  const t0 = Date.now();
  const id = getRouterParam(event, "id");
  const body = await readValidatedBody(event, bodySchema.parse);

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  const project = await db.query.projects.findFirst({
    where: { id },
  });
  console.log(`[session] DB lookup: ${Date.now() - t0}ms`);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const config = parseConfig(project.configOverride);
  const port = config.opencodePort;

  if (!port) {
    throw createError({
      statusCode: 400,
      message: "OpenCode server not running. Call /start first.",
    });
  }

  // Try to reuse existing session (unless forceNew is requested)
  if (config.sessionId && !body?.forceNew) {
    try {
      const t1 = Date.now();
      const res = await fetch(
        `http://localhost:${port}/session/${config.sessionId}`,
      );
      if (res.ok) {
        const session = await res.json();
        console.log(`[session] Reconnected to ${session.id}: ${Date.now() - t1}ms (total: ${Date.now() - t0}ms)`);
        return { sessionId: session.id, port, reconnected: true };
      }
      console.log(`[session] Reconnect failed (${res.status}): ${Date.now() - t1}ms`);
    } catch (e: any) {
      console.log(`[session] Reconnect error: ${e.message}`);
    }
  }

  // Create a new session
  try {
    const t2 = Date.now();
    const res = await fetch(`http://localhost:${port}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const session = await res.json();
    console.log(`[session] Created new ${session.id}: ${Date.now() - t2}ms`);

    // Store the session ID in configOverride for future reconnection
    await db
      .update(projects)
      .set({
        configOverride: {
          ...config,
          sessionId: session.id,
        } as any,
      })
      .where(eq(projects.id, id));

    console.log(`[session] Total: ${Date.now() - t0}ms`);
    return { sessionId: session.id, port, reconnected: false };
  } catch (e) {
    console.log(`[session] Failed to create: ${Date.now() - t0}ms`);
    throw createError({
      statusCode: 500,
      message: "Failed to create session on OpenCode server",
    });
  }
});
