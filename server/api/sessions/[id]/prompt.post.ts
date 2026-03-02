/**
 * DEPRECATED: Chat prompting now goes through /api/chat via Vercel AI SDK.
 * This endpoint is kept as a stub for backward compatibility.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "id is required" });
  }

  throw createError({
    statusCode: 410,
    message: "This endpoint is deprecated. Use /api/chat instead.",
  });
});
