import { db } from "../../database";
import { devProfile } from "../../database/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod/v4";

const bodySchema = z.object({
  entries: z.array(
    z.object({
      id: z.string().optional(),
      key: z.string().min(1),
      value: z.string(),
      category: z.enum(["style", "preference", "convention", "rule"]),
    }),
  ),
});

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse);

  for (const entry of body.entries) {
    if (entry.id) {
      await db
        .update(devProfile)
        .set({ key: entry.key, value: entry.value, category: entry.category })
        .where(eq(devProfile.id, entry.id));
    } else {
      await db.insert(devProfile).values({
        id: nanoid(),
        key: entry.key,
        value: entry.value,
        category: entry.category,
      });
    }
  }

  return db.select().from(devProfile);
});
