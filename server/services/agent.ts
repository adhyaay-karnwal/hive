import {
  createAnthropic,
  type AnthropicLanguageModelOptions,
} from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { streamText, stepCountIs, type CoreMessage, type UIMessageStreamWriter } from "ai";
import { tool, jsonSchema } from "ai";
import { createBashTool } from "./tools/bash";
import { createTextEditorTool } from "./tools/text-editor";
import { createSpawnAgentTool } from "./tools/spawn-agent";
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
  headers: {
    "anthropic-beta": "context-1m-2025-08-07",
  },
});

/**
 * Get the model instance for a given preference.
 */
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
  const modelId =
    preference === "opus" ? "claude-opus-4-6" : "claude-sonnet-4-6";
  return anthropic(modelId);
}

export interface RunAgentOptions {
  messages: CoreMessage[];
  projectPath: string;
  modelPreference: "anthropic-opus" | "anthropic-sonnet" | "gemini-flash" | "gemini-pro";
  modePreference?: "build" | "plan";
  systemPrompt: string;
  thinkingBudget?: number;
}
  messages: CoreMessage[];
  projectPath: string;
  modelPreference: "opus" | "sonnet";
  modePreference?: "build" | "plan";
  systemPrompt: string;
  thinkingBudget?: number;
}


/**
 * Run the agent with streaming, tools, and extended thinking.
 * Returns the streaming result from streamText.
 */
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
  const tools = isPlanMode
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
        spawnAgent: createSpawnAgentTool(projectPath, modelPreference),
      };

  // Higher thinking budget for plan mode (more analysis required)
  const effectiveThinkingBudget = isPlanMode ? Math.max(thinkingBudget, 30_000) : thinkingBudget;



  return streamText({
    model,
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 100,
    stopWhen: stepCountIs(100),
    providerOptions: {
      anthropic: {
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
      } satisfies AnthropicLanguageModelOptions,
    },
  });
}
