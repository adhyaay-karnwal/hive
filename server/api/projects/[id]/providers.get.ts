/**
 * Returns available AI providers and models.
 * Model selection is handled client-side.
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
