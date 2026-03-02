import { db } from "../../../../database";
import { changeComments } from "../../../../database/schema";
import { inArray } from "drizzle-orm";
import { z } from "zod/v4";

const bodySchema = z.object({
  ids: z.array(z.string()).min(1),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse);

  await db
    .update(changeComments)
    .set({ resolved: true })
    .where(inArray(changeComments.id, body.ids));

  return { resolved: body.ids.length };
});
