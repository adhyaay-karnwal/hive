import {
  createAnthropic,
  type AnthropicLanguageModelOptions,
} from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { streamText, stepCountIs, type CoreMessage } from "ai";
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
 * Create the Google Gemini provider.
 * Uses GOOGLE_GENERATIVE_AI_API_KEY environment variable.
 */
export const google = createGoogle({
  // Will use GOOGLE_GENERATIVE_AI_API_KEY env var by default
});

/**
 * Get the model instance for a given preference.
 * Supports both Anthropic and Gemini models.
 */
export function getModel(preference: "anthropic-opus" | "anthropic-sonnet" | "gemini-flash" | "gemini-pro") {
  const [provider, model] = preference.split("-") as ["anthropic" | "gemini", string];
  
  if (provider === "anthropic") {
    const modelId = model === "opus" ? "claude-opus-4-6" : "claude-sonnet-4-6";
    return anthropic(modelId);
  }
  
  // Gemini models
  const geminiModelId = model === "flash" ? "gemini-2.0-flash" : "gemini-2.0-pro";
  return google(geminiModelId);
}

/**
 * Get the provider type from a model preference.
 */
export function getProviderType(preference: string): "anthropic" | "gemini" {
  return preference.startsWith("anthropic") ? "anthropic" : "gemini";
}

export interface RunAgentOptions {
  messages: CoreMessage[];
  projectPath: string;
  modelPreference: "anthropic-opus" | "anthropic-sonnet" | "gemini-flash" | "gemini-pro";
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
  const providerType = getProviderType(modelPreference);

  // Build tool set based on mode - plan mode has read-only tools
  const isPlanMode = modePreference === "plan";
  
  // Get the base provider (anthropic or google)
  const baseProvider = providerType === "anthropic" ? anthropic : google;
  
  // Plan mode: read-only tools (bash and web for research, but no file editing or spawning)
  // Build mode: full tools including text editor and spawn agent
  
  // Create bash tool - works with both providers
  const bashTool = createBashTool(baseProvider, projectPath);
  
  // Create text editor tool - works with both providers  
  const textEditorTool = createTextEditorTool(baseProvider, projectPath);
  
  // Build the tools object
  const tools = isPlanMode
    ? {
        // Read-only tools for planning/analysis - can research but not modify files
        bash: bashTool,
        str_replace_based_edit_tool: textEditorTool,
        // Note: spawnAgent disabled in plan mode - must use build mode for implementation
      }
    : {
        // Full tools for building
        bash: bashTool,
        str_replace_based_edit_tool: textEditorTool,
        spawnAgent: createSpawnAgentTool(projectPath, modelPreference),
      };

  // Higher thinking budget for plan mode (more analysis required)
  const effectiveThinkingBudget = isPlanMode ? Math.max(thinkingBudget, 30_000) : thinkingBudget;

  // Build provider-specific options
  const providerOptions = providerType === "anthropic"
    ? {
        anthropic: {
          thinking: { type: "enabled" as const, budgetTokens: effectiveThinkingBudget },
          contextManagement: {
            edits: [
              {
                type: "compact_20260112",
                trigger: { type: "input_tokens" as const, value: 800_000 },
                instructions:
                  "Preserve key decisions, file changes made, current task state, and any errors encountered.",
              },
              {
                type: "clear_tool_uses_20250919",
                trigger: { type: "input_tokens" as const, value: 500_000 },
                keep: { type: "tool_uses" as const, value: 10 },
                clearAtLeast: { type: "input_tokens" as const, value: 50_000 },
                clearToolInputs: true,
              },
            ],
          },
        } satisfies AnthropicLanguageModelOptions,
      }
    : {};

  return streamText({
    model,
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 100,
    stopWhen: stepCountIs(100),
    providerOptions,
  });
}
