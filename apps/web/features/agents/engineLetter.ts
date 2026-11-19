import type { EngineBadgeEngine } from "@zibby/design-system";

const LETTER: Record<EngineBadgeEngine, string> = { claude: "C", openai: "O", opencode: "OC" };

/** The short mono mark the list cards pin to an avatar for an engine. */
export const engineLetter = (engine: EngineBadgeEngine): string => LETTER[engine];
