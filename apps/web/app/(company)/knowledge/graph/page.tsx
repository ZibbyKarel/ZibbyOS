import { redirect } from "next/navigation";
import { legacyBrainNote } from "../../../../features/knowledge/brainModel";

/** Legacy link: `?note=` / `?source=team:<id>&note=` map to the unified Mozek id. */
export default async function LegacyKnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string; source?: string }>;
}) {
  const { note, source } = await searchParams;
  const id = legacyBrainNote(source ?? null, note ?? null);
  redirect(id ? `/knowledge/brain?note=${encodeURIComponent(id)}` : "/knowledge/brain");
}
