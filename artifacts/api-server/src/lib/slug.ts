import { and, eq, isNull, ne } from "drizzle-orm";
import { db, mangaTable, creatorsTable } from "@workspace/db";

/** "Supar man bana Lazy man!" -> "supar-man-bana-lazy-man". Keeps Hindi and other Indian scripts. */
export function slugify(title: string): string {
  const s = title
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return s || "series";
}

/** Give a manga a unique, readable slug based on its title ("name", "name-2", …). */
export async function assignMangaSlug(id: number, title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 1; i < 500; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    // A bare number would look like an id, so never use one as a slug.
    if (/^\d+$/.test(candidate)) continue;
    const [taken] = await db.select({ id: mangaTable.id }).from(mangaTable)
      .where(and(eq(mangaTable.slug, candidate), ne(mangaTable.id, id)));
    if (!taken) {
      await db.update(mangaTable).set({ slug: candidate }).where(eq(mangaTable.id, id));
      return candidate;
    }
  }
  const fallback = `${base}-${id}`;
  await db.update(mangaTable).set({ slug: fallback }).where(eq(mangaTable.id, id));
  return fallback;
}

/** Fill slugs for any series created before slugs existed. */
export async function backfillMangaSlugs(): Promise<void> {
  const rows = await db.select({ id: mangaTable.id, title: mangaTable.title }).from(mangaTable)
    .where(isNull(mangaTable.slug)).orderBy(mangaTable.id);
  for (const r of rows) await assignMangaSlug(r.id, r.title);
}



/** Readable creator page URL ("/creator/ishwar-studio"). */
export async function assignCreatorSlug(id: number, name: string): Promise<string> {
  const base = slugify(name) === "series" ? "creator" : slugify(name);
  for (let i = 1; i < 500; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    if (/^\d+$/.test(candidate)) continue;
    const [taken] = await db.select({ id: creatorsTable.id }).from(creatorsTable)
      .where(and(eq(creatorsTable.slug, candidate), ne(creatorsTable.id, id)));
    if (!taken) {
      await db.update(creatorsTable).set({ slug: candidate }).where(eq(creatorsTable.id, id));
      return candidate;
    }
  }
  const fallback = `${base}-${id}`;
  await db.update(creatorsTable).set({ slug: fallback }).where(eq(creatorsTable.id, id));
  return fallback;
}

export async function backfillSlugs(): Promise<void> {
  await backfillMangaSlugs();
  const rows = await db.select({ id: creatorsTable.id, name: creatorsTable.name }).from(creatorsTable)
    .where(isNull(creatorsTable.slug)).orderBy(creatorsTable.id);
  for (const r of rows) await assignCreatorSlug(r.id, r.name);
}
