/**
 * DEPRECATED: Abort is now handled client-side via useChat's stop() method.
 * This endpoint is kept as a stub for backward compatibility.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  // Abort is handled client-side by the Vercel AI SDK's stop() method.
  // Nothing to do server-side.
  return { success: true };
});
