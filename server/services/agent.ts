import {
  createAnthropic,
  type AnthropicLanguageModelOptions,
} from "@ai-sdk/anthropic";
import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { streamText, stepCountIs } from "ai";
import type { UIMessageStreamWriter, ToolSet, ModelMessage } from "ai";
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
export function getModel(preference: "opus" | "sonnet" | "gemini-3-pro" | "gemini-3-flash") {
  if (preference === "gemini-3-pro") {
    return google("gemini-3.1-pro-preview");
  }
  if (preference === "gemini-3-flash") {
    return google("gemini-3-flash-preview");
  }

  const modelId =
    preference === "opus" ? "claude-opus-4-6" : "claude-sonnet-4-6";
  return anthropic(modelId);
}

export interface RunAgentOptions {
  messages: ModelMessage[];
  projectPath: string;
  modelPreference: "opus" | "sonnet" | "gemini-3-pro" | "gemini-3-flash";
  modePreference?: "build" | "plan";
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
    modePreference = "build",
    systemPrompt,
    thinkingBudget = 10_000,
  } = options;
  const model = getModel(modelPreference);

  // Build tool set based on mode - plan mode has read-only tools
  const isPlanMode = modePreference === "plan";
  
  // Plan mode: read-only tools (bash and web for research, but no file editing or spawning)
  // Build mode: full tools including text editor and spawn agent
  const tools: ToolSet = isPlanMode
    ? {
        // Read-only tools for planning/analysis - can research but not modify files
        bash: createBashTool(anthropic, projectPath),
        str_replace_based_edit_tool: createTextEditorTool(anthropic, projectPath),
        webSearch: anthropic.tools.webSearch_20250305({ maxUses: 10 }),
        webFetch: anthropic.tools.webFetch_20250910({ maxUses: 10 }),
        codeExecution: anthropic.tools.codeExecution_20260120(),
        // Note: spawnAgent disabled in plan mode - must use build mode for implementation
      }
    : {
        // Full tools for building
        bash: createBashTool(anthropic, projectPath),
        str_replace_based_edit_tool: createTextEditorTool(anthropic, projectPath),
        webSearch: anthropic.tools.webSearch_20250305({ maxUses: 10 }),
        webFetch: anthropic.tools.webFetch_20250910({ maxUses: 10 }),
        codeExecution: anthropic.tools.codeExecution_20260120(),
        spawnAgent: createSpawnAgentTool(projectPath, modelPreference) as any,
      };

  // Higher thinking budget for plan mode (more analysis required)
  const effectiveThinkingBudget = isPlanMode ? Math.max(thinkingBudget, 30_000) : thinkingBudget;



  const providerOptions: any = {};

  if (modelPreference === "opus" || modelPreference === "sonnet") {
    providerOptions.anthropic = {
      thinking: { type: "enabled", budgetTokens: effectiveThinkingBudget },
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
    } satisfies AnthropicLanguageModelOptions;
  } else if (modelPreference === "gemini-3-pro" || modelPreference === "gemini-3-flash") {
    providerOptions.google = {
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel: isPlanMode ? "high" : "medium",
      },
    } satisfies GoogleLanguageModelOptions;
  }

  return streamText({
    model,
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 100,
    stopWhen: stepCountIs(100),
    providerOptions,
  } as any);
}
