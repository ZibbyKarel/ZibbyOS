/** Generated figures sometimes get an extra tail or arm; every page and cover asks for correct anatomy. */
const ANATOMY =
  "anatomically correct: every person has one head, two arms and two legs, every animal its natural number of legs and ears and one tail, no extra, fused, duplicated or floating limbs";

/** Appended to every coloring-page prompt by the real providers. */
export const COLORING_SUFFIX = `black and white coloring book page, thick clean black outlines, a full scene with foreground, middle ground and background, plenty of open white areas to colour in, white fill inside all shapes, no shading, no gray, no color, no text, ${ANATOMY}`;

/** Appended to the cover prompt instead: the cover is the one full-colour image. */
export const COVER_SUFFIX = `full-colour children's book cover illustration, vibrant saturated flat colours, coloured background edge to edge, bold dark outlines, no text, no letters, no words, ${ANATOMY}`;

/** Appended to a title-buddy sticker: one coloured character, cut out from a white background. */
export const STICKER_SUFFIX =
  "full-colour flat vector sticker, saturated flat colours, bold dark outline closed all around the character, plain pure white background, nothing else, no shadow, no text";

/** Appended to a character reference sheet (`char-<id>`): the character alone, no scene around it. */
export const SHEET_SUFFIX = `black and white coloring book line art, thick clean black outlines, the character alone on a plain pure white background, no scenery, no ground, no other figures, white fill inside all shapes, no shading, no gray, no color, no text, ${ANATOMY}`;

/** Item keys: `cover`, `buddy-<n>` (sticker), `char-<id>` (sheet), anything else is a black-and-white line-art page. */
const suffixOf = (key: string): string =>
  key === "cover"
    ? COVER_SUFFIX
    : key.startsWith("buddy-")
      ? STICKER_SUFFIX
      : key.startsWith("char-")
        ? SHEET_SUFFIX
        : COLORING_SUFFIX;

/** The prompt a real provider sends: the item's prompt plus the page, cover or sticker suffix. */
export const promptFor = (item: { key: string; prompt: string }): string =>
  `${item.prompt}. ${suffixOf(item.key)}`;

export interface ImageItem {
  key: string;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  /** PNGs the model must keep the characters of (image-conditioned editing). */
  referenceImages?: string[];
  /** 1-based attempt for this key (lets test providers vary behaviour). */
  attempt?: number;
}

export interface ImageResult {
  key: string;
  file: string;
  durationMs: number;
  costUsd: number;
}

export interface ImageProvider {
  id: string;
  model: string;
  /** Batch call so a local model can stay loaded for the whole batch. Files are written into outDir. */
  generateBatch(items: ImageItem[], outDir: string): Promise<ImageResult[]>;
  /** Optional: release memory (unload models) after the phase. */
  dispose?(): Promise<void>;
}
