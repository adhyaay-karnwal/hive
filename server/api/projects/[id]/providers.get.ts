/**
 * Previously returned OpenCode provider/model info.
 * No longer needed — model selection is handled client-side.
 * Kept as a stub to avoid 404s from any lingering references.
 */
export default defineEventHandler(() => {
  return {
    models: [
      // Anthropic models
      { id: "anthropic-opus", name: "Claude Opus 4", provider: "anthropic" },
      { id: "anthropic-sonnet", name: "Claude Sonnet 4", provider: "anthropic" },
      // Gemini models
      { id: "gemini-flash", name: "Gemini 2.0 Flash", provider: "gemini" },
      { id: "gemini-pro", name: "Gemini 2.0 Pro", provider: "gemini" },
    ],
  };
});
  return {
    models: [
      { id: "opus", name: "Claude Opus" },
      { id: "sonnet", name: "Claude Sonnet" },
    ],
  };
});
