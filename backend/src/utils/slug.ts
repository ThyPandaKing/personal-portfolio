import slugify from "slugify";
import type { Model } from "mongoose";

const base = (input: string) => slugify(input, { lower: true, strict: true, trim: true });

/**
 * Generate a slug unique within the given model's collection.
 * Appends -2, -3, ... on collision. Pass excludeId when updating an existing doc.
 */
export async function uniqueSlug(
  model: Model<any>,
  input: string,
  excludeId?: string,
): Promise<string> {
  const root = base(input) || "item";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await model.findOne({ slug: candidate }).select("_id").lean();
    if (!existing || String((existing as { _id: unknown })._id) === excludeId) {
      return candidate;
    }
    n += 1;
    candidate = `${root}-${n}`;
  }
}
