import { tool, jsonSchema, generateId } from "ai";
import type { UIMessageStreamWriter } from "ai";
import { createWorktree } from "../worktree";

/**
 * Create a tool for spawning sub-agents.
 * Sub-agents can optionally work in isolated git worktrees.
 *
 * When a `writer` is provided (from createUIMessageStream), the sub-agent's
 * output is streamed to the client in real time as `data-subAgent` parts,
 * with the same ID being reconciled on each chunk so the UI updates in place.
 */
export function createSpawnAgentTool(
  projectPath: string,
  modelPreference: "anthropic-opus" | "anthropic-sonnet" | "gemini-flash" | "gemini-pro",
  writer?: UIMessageStreamWriter,
) {
  projectPath: string,
  modelPreference: "opus" | "sonnet",
  writer?: UIMessageStreamWriter,
) {
  return tool({
    description:
      "Spawn a sub-agent to work on a task. " +
      "Use 'isolated: true' with a branch name to create a git worktree " +
      "so the sub-agent works on a separate branch without affecting the main tree. " +
      "The sub-agent has access to the same tools (bash, text editor, web search, etc).",
    inputSchema: jsonSchema<{
      task: string;
      isolated?: boolean;
      branchName?: string;
    }>({
      type: "object",
      properties: {
        task: {
          type: "string",
          description:
            "Detailed description of the task for the sub-agent to complete.",
        },
        isolated: {
          type: "boolean",
          description:
            "If true, create a git worktree for isolated work. Default: false.",
        },
        branchName: {
          type: "string",
          description:
            "Branch name for the worktree. Required if isolated is true.",
        },
      },
      required: ["task"],
    }),
    execute: async ({ task, isolated, branchName }) => {
      // Lazy import to avoid circular dependency
      const { runAgent } = await import("../agent");

      let agentCwd = projectPath;

      if (isolated) {
        if (!branchName) {
          return "Error: branchName is required when isolated is true.";
        }

        try {
          agentCwd = await createWorktree(projectPath, branchName);
        } catch (e: any) {
          return `Error creating worktree: ${e.message}`;
        }
      }

      const systemPrompt = [
        "You are a sub-agent working on a specific task.",
        "Complete the task thoroughly and report your results.",
        `Working directory: ${agentCwd}`,
        "",
        "## Task",
        task,
      ].join("\n");

      // Stable ID for this sub-agent invocation — the client reconciles writes
      // with the same ID so the panel updates in place rather than appending.
      const partId = generateId();

      try {
        const result = await runAgent({
          messages: [{ role: "user", content: task }],
          projectPath: agentCwd,
          modelPreference,
          systemPrompt,
        });

        let fullText = "";

        // Stream each text chunk to the client as a data-subAgent part update.
        for await (const chunk of result.textStream) {
          fullText += chunk;

          writer?.write({
            type: "data-subAgent",
            id: partId,
            data: {
              task,
              status: "streaming" as const,
              text: fullText,
            },
          });
        }

        // Final update — mark as done so the client can collapse / finalise the panel.
        writer?.write({
          type: "data-subAgent",
          id: partId,
          data: {
            task,
            status: "done" as const,
            text: fullText,
          },
        });

        return fullText || "(sub-agent produced no text output)";
      } catch (e: any) {
        writer?.write({
          type: "data-subAgent",
          id: partId,
          data: {
            task,
            status: "error" as const,
            text: `Sub-agent error: ${e.message}`,
          },
        });

        return `Sub-agent error: ${e.message}`;
      }
    },
  });
}
