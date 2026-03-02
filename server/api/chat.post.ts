import { defineEventHandler, readBody } from "h3";
import { convertToModelMessages, generateId } from "ai";
import type { UIMessage } from "ai";
import { db } from "../database";
import { projects, messages as messagesTable } from "../database/schema";
import { buildMainPrompt } from "../services/prompt-builder";
import { runAgent } from "../services/agent";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const { messages, projectId, model } = body as {
    messages: UIMessage[];
    projectId: string;
    model?: "opus" | "sonnet";
  };

  if (!messages || !projectId) {
    throw createError({
      statusCode: 400,
      message: "messages and projectId are required",
    });
  }

  // Look up the project to get its path
  const project = await db.query.projects.findFirst({
    where: { id: projectId },
  });

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  // Build the system prompt
  const systemPrompt = await buildMainPrompt(projectId);

  // Convert UIMessages from the client to ModelMessages for streamText
  const modelMessages = await convertToModelMessages(messages);

  // Debug: log what tools look like
  console.log("[chat] messages count:", modelMessages.length);
  console.log("[chat] model:", model || "sonnet");

  // Run the agent with streaming
  const result = runAgent({
    messages: modelMessages,
    projectPath: project.path,
    modelPreference: model || "sonnet",
    systemPrompt,
  });

  // Return the streaming response compatible with Chat class.
  // Pass originalMessages so the SDK uses persistence mode (assigns stable IDs
  // to assistant messages) and calls onFinish with the full updated message list.
  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: () => generateId(),
    onFinish: async ({ messages: updatedMessages }) => {
      try {
        // The client sends all prior messages on every turn, so we diff by ID
        // to avoid duplicates and only write genuinely new messages.
        const existingIds = new Set(messages.map((m) => m.id));
        const newMessages = updatedMessages.filter((m) => !existingIds.has(m.id));

        if (newMessages.length === 0) return;

        await db.insert(messagesTable).values(
          newMessages.map((m) => ({
            id: m.id,
            projectId,
            role: m.role as "user" | "assistant" | "system" | "tool",
            content: m.parts ?? m.content,
            createdAt: new Date(),
          })),
        );

        console.log(`[chat] persisted ${newMessages.length} new message(s) for project ${projectId}`);
      } catch (e: any) {
        console.error("[chat] failed to persist messages:", e.message);
      }
    },
  });
});
