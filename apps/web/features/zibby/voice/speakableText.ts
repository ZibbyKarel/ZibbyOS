/**
 * Turns a markdown reply into text worth reading aloud: code blocks dropped, links reduced
 * to their label, bare URLs removed, emphasis / heading / list markers stripped.
 */
export function toSpeakableText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, "$1")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Longest piece sent to TTS in one call. */
export const MAX_SPEECH_CHUNK = 320;

/** Splits speakable text at sentence boundaries into pieces of at most `max` characters. */
export function chunkForSpeech(text: string, max = MAX_SPEECH_CHUNK): string[] {
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };
  for (const sentence of sentences) {
    if (cur && cur.length + sentence.length > max) push();
    if (sentence.length > max) {
      // a sentence longer than the cap: break on spaces
      for (const word of sentence.split(/\s+/)) {
        if (cur && cur.length + word.length + 1 > max) push();
        cur += (cur ? " " : "") + word;
      }
    } else {
      cur += sentence;
    }
  }
  push();
  return chunks;
}
