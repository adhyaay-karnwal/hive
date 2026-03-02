import {
  createAnthropic,
  type AnthropicLanguageModelOptions,
} from "@ai-sdk/anthropic";
import { streamText, stepCountIs, type CoreMessage, type UIMessageStreamWriter } from "ai";
import { createBashTool } from "./tools/bash";
import { createTextEditorTool } from "./tools/text-editor";
import { createSpawnAgentTool } from "./tools/spawn-agent";

/**
 * Create the Anthropic provider with 1M context window support.
 */
export const anthropic = createAnthropic({
  headers: {
    "anthropic-beta": "context-1m-2025-08-07",
  },
});

/**
 * Get the model instance for a given preference.
 */
export function getModel(preference: "opus" | "sonnet") {
  const modelId =
    preference === "opus" ? "claude-opus-4-6" : "claude-sonnet-4-6";
  return anthropic(modelId);
}

export interface RunAgentOptions {
  messages: CoreMessage[];
  projectPath: string;
  modelPreference: "opus" | "sonnet";
  systemPrompt: string;
  thinkingBudget?: number;
}

/**
 * Run the agent with streaming, tools, and extended thinking.
 * Returns the streaming result from streamText.
 */
export function runAgent(options: RunAgentOptions) {
  const {
    messages,
    projectPath,
    modelPreference,
    systemPrompt,
    thinkingBudget = 10_000,
  } = options;

  const model = getModel(modelPreference);

  // Build the tool set
  const tools = {
    bash: createBashTool(anthropic, projectPath),
    str_replace_based_edit_tool: createTextEditorTool(anthropic, projectPath),
    webSearch: anthropic.tools.webSearch_20250305({ maxUses: 10 }),
    webFetch: anthropic.tools.webFetch_20250910({ maxUses: 10 }),
    codeExecution: anthropic.tools.codeExecution_20260120(),
    spawnAgent: createSpawnAgentTool(projectPath, modelPreference),
  };

  return streamText({
    model,
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 100,
    stopWhen: stepCountIs(100),
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: thinkingBudget },
        contextManagement: {
          edits: [
            {
              type: "compact_20260112",
              trigger: { type: "input_tokens", value: 800_000 },
              instructions:
                "Preserve key decisions, file changes made, current task state, and any errors encountered.",
            },
            {
              type: "clear_tool_uses_20250919",
              trigger: { type: "input_tokens", value: 500_000 },
              keep: { type: "tool_uses", value: 10 },
              clearAtLeast: { type: "input_tokens", value: 50_000 },
              clearToolInputs: true,
            },
          ],
        },
      } satisfies AnthropicLanguageModelOptions,
    },
  });
}
