/**
 * Previously returned OpenCode provider/model info.
 * No longer needed — model selection is handled client-side.
 * Kept as a stub to avoid 404s from any lingering references.
 */
export default defineEventHandler(() => {
  return {
    models: [
      { id: "opus", name: "Claude Opus" },
      { id: "sonnet", name: "Claude Sonnet" },
    ],
  };
});
