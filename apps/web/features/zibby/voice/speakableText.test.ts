import { describe, expect, it } from "vitest";
import { chunkForSpeech, toSpeakableText } from "./speakableText";

describe("toSpeakableText", () => {
  it("strips markdown", () => {
    const md =
      "## Hotovo\n- **PR** [#12](https://x.y) je `ready`\n```ts\nconst a=1\n```\nVíc na https://a.b";
    expect(toSpeakableText(md)).toBe("Hotovo PR #12 je ready Víc na");
  });
});

describe("chunkForSpeech", () => {
  it("keeps short text whole and splits long text at sentences", () => {
    expect(chunkForSpeech("Ahoj. Jak se máš?")).toEqual(["Ahoj. Jak se máš?"]);
    const long = Array.from(
      { length: 10 },
      (_, i) => `Věta číslo ${i} je docela dlouhá a plná slov.`,
    ).join(" ");
    const chunks = chunkForSpeech(long, 100);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join(" ")).toBe(long);
  });
});
