import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChatMessage } from "@zibby/contracts";
import { ChatTranscriptStore, isValidConversationId } from "./chat-transcript.store";

const msg = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "m1",
  role: "user",
  text: "ahoj",
  at: "2026-06-23T10:00:00.000Z",
  ...over,
});

describe("ChatTranscriptStore", () => {
  let dir: string;
  let store: ChatTranscriptStore;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "zibby-chat-"));
    store = new ChatTranscriptStore(dir);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("creates and reuses the single active conversation when no id is given", async () => {
    const first = await store.ensureConversation();
    const second = await store.ensureConversation();
    expect(first).toBe(second);
    expect(await store.readActive()).toBe(first);
  });

  it("honors an explicit conversation id and creates its meta", async () => {
    const id = await store.ensureConversation("conv-explicit");
    expect(id).toBe("conv-explicit");
    // explicit ids do not hijack the active pointer
    expect(await store.readActive()).toBeNull();
  });

  it("round-trips appended messages newest-last", async () => {
    const id = await store.ensureConversation("c1");
    await store.appendMessage(id, msg({ id: "u1", role: "user", text: "jak se máš?" }));
    await store.appendMessage(id, msg({ id: "a1", role: "assistant", text: "Skvěle. 🎩" }));
    const transcript = await store.readTranscript(id);
    expect(transcript.messages.map((m) => m.id)).toEqual(["u1", "a1"]);
    expect(transcript.messages[1]?.text).toBe("Skvěle. 🎩");
  });

  it("persists and reads back the threaded session id", async () => {
    const id = await store.ensureConversation("c2");
    expect(await store.getSessionId(id)).toBeNull();
    await store.setSessionId(id, "sess-xyz");
    expect(await store.getSessionId(id)).toBe("sess-xyz");
    expect((await store.readTranscript(id)).sessionId).toBe("sess-xyz");
  });

  it("skips malformed transcript lines without throwing", async () => {
    const id = await store.ensureConversation("c3");
    await store.appendMessage(id, msg({ id: "ok" }));
    await fs.appendFile(path.join(dir, "c3.jsonl"), "garbage not json\n", "utf8");
    await store.appendMessage(id, msg({ id: "ok2" }));
    const transcript = await store.readTranscript(id);
    expect(transcript.messages.map((m) => m.id)).toEqual(["ok", "ok2"]);
  });

  it("returns an empty transcript for an unknown conversation", async () => {
    const transcript = await store.readTranscript("missing");
    expect(transcript).toEqual({ conversationId: "missing", sessionId: null, messages: [] });
  });

  it("lists conversation ids from transcript files only", async () => {
    await store.ensureConversation("c-a");
    await store.appendMessage("c-a", msg());
    await store.ensureConversation("c-b");
    await store.appendMessage("c-b", msg());
    const ids = (await store.listConversationIds()).sort();
    // .meta.json / .distilled.json / active.json must not appear
    expect(ids).toEqual(["c-a", "c-b"]);
  });

  it("tracks the incremental distilled-through cursor", async () => {
    expect(await store.distilledCount("c1")).toBe(0);
    await store.markDistilled("c1", 3);
    expect(await store.distilledCount("c1")).toBe(3);
    await store.markDistilled("c1", 7);
    expect(await store.distilledCount("c1")).toBe(7);
  });

  describe("D-020 — AttachmentSetRefProvider", () => {
    it("returns no ids when nothing was ever attached", async () => {
      await store.ensureConversation("c-none");
      await store.appendMessage("c-none", msg());
      expect(await store.referencedSetIds()).toEqual([]);
    });

    it("collects a referenced attachmentSetId across conversations, deduplicated", async () => {
      await store.ensureConversation("c-a");
      await store.appendMessage(
        "c-a",
        msg({ attachmentSetId: "set_1", attachments: [{ name: "a.txt", size: 1 }] }),
      );
      await store.ensureConversation("c-b");
      await store.appendMessage("c-b", msg({ attachmentSetId: "set_1" }));
      await store.appendMessage("c-b", msg({ id: "m2", attachmentSetId: "set_2" }));

      expect((await store.referencedSetIds()).sort()).toEqual(["set_1", "set_2"]);
    });

    it("never throws when the chat dir doesn't exist yet", async () => {
      const empty = new ChatTranscriptStore(path.join(dir, "does-not-exist"));
      await expect(empty.referencedSetIds()).resolves.toEqual([]);
    });
  });

  it("lists non-empty conversations newest first, titled by the first user turn, filtered by q", async () => {
    await store.appendMessage("old", msg({ id: "a0", role: "assistant", text: "briefing" }));
    await store.appendMessage(
      "old",
      msg({ id: "u0", text: "Deploy  the\nAPI", at: "2026-06-23T10:01:00.000Z" }),
    );
    await store.appendMessage(
      "new",
      msg({ id: "u1", text: "faktura", at: "2026-06-24T09:00:00.000Z" }),
    );
    await store.ensureConversation("empty");

    const all = await store.listConversations();
    expect(all.map((c) => c.conversationId)).toEqual(["new", "old"]);
    expect(all[1]).toEqual({
      conversationId: "old",
      title: "Deploy the API",
      messageCount: 2,
      updatedAt: "2026-06-23T10:01:00.000Z",
    });
    expect((await store.listConversations("BRIEF")).map((c) => c.conversationId)).toEqual(["old"]);
  });

  describe("conversation management", () => {
    const trashOf = (id: string) => path.join(dir, ".trash", id);
    const seed = async (id: string, text = "ahoj světe") => {
      await store.ensureConversation(id);
      await store.appendMessage(id, msg({ id: `${id}-u`, text }));
      await store.setSessionId(id, "sess-1");
      await store.markDistilled(id, 1);
    };

    it("rejects path-traversal ids everywhere", async () => {
      for (const bad of ["../x", "a/b", "..", ".trash", "", "a.b", "-x"]) {
        expect(isValidConversationId(bad)).toBe(false);
        expect(await store.deleteConversation(bad)).toBe(false);
        expect(await store.clearConversation(bad)).toBe(false);
        expect(await store.restoreConversation(bad)).toBeNull();
        expect(await store.renameConversation(bad, "x")).toBeNull();
      }
      await expect(store.readTranscript("../x")).rejects.toThrow(/Invalid chat conversation id/);
      expect(isValidConversationId("conv_1731660000000_ab12cd")).toBe(true);
    });

    it("renames: the custom title wins in the list; unknown -> null", async () => {
      await seed("c1", "first turn");
      const renamed = await store.renameConversation("c1", "  Můj  název ");
      expect(renamed?.title).toBe("Můj název");
      expect((await store.listConversations())[0]?.title).toBe("Můj název");
      expect((await store.listConversations("Můj"))[0]?.snippet).toBeUndefined();
      expect(await store.renameConversation("nope", "x")).toBeNull();
    });

    it("soft-deletes into .trash, hides it everywhere, clears the active pointer", async () => {
      const active = await store.ensureConversation();
      await store.appendMessage(active, msg({ attachmentSetId: "set-1" }));
      await store.markDistilled(active, 1);
      expect(await store.deleteConversation(active)).toBe(true);

      expect(await store.readActive()).toBeNull();
      expect(await store.listConversations()).toEqual([]);
      expect(await store.listConversationIds()).toEqual([]);
      expect(await store.referencedSetIds()).toEqual([]);
      expect((await fs.readdir(trashOf(active))).sort()).toEqual(
        [`${active}.distilled.json`, `${active}.jsonl`, `${active}.meta.json`].sort(),
      );
      expect(await fs.readdir(dir)).toEqual([".trash"]);
      expect(await store.deleteConversation(active)).toBe(false);
    });

    it("restores a deleted conversation intact", async () => {
      await seed("c1");
      await store.deleteConversation("c1");
      const restored = await store.restoreConversation("c1");
      expect(restored).toMatchObject({ conversationId: "c1", messageCount: 1 });
      expect(await store.getSessionId("c1")).toBe("sess-1");
      expect(await store.distilledCount("c1")).toBe(1);
      expect((await store.listConversations()).map((c) => c.conversationId)).toEqual(["c1"]);
      expect(await store.restoreConversation("c1")).toBeNull();
    });

    it("clears in place (snapshot kept) and restore overwrites the emptied files", async () => {
      await seed("c1");
      await store.renameConversation("c1", "Titulek");
      expect(await store.clearConversation("c1")).toBe(true);

      const transcript = await store.readTranscript("c1");
      expect(transcript.messages).toEqual([]);
      expect(transcript.sessionId).toBeNull();
      expect(await store.distilledCount("c1")).toBe(0);
      expect(await store.listConversations()).toEqual([]);
      expect((await fs.readdir(trashOf("c1"))).length).toBe(3);

      const restored = await store.restoreConversation("c1");
      expect(restored).toMatchObject({ title: "Titulek", messageCount: 1 });
      expect(await store.getSessionId("c1")).toBe("sess-1");
      expect(await store.distilledCount("c1")).toBe(1);
    });

    it("keeps an older snapshot instead of overwriting it", async () => {
      await seed("c1", "one");
      await store.deleteConversation("c1");
      await seed("c1", "two");
      await store.deleteConversation("c1");
      const names = await fs.readdir(path.join(dir, ".trash"));
      expect(names.length).toBe(2);
      const restored = await store.restoreConversation("c1");
      expect(restored?.title).toBe("two");
    });

    it("adds a centred single-line snippet for message hits, none for title-only hits", async () => {
      const long = `${"a ".repeat(100)}NEEDLE\nmiddle ${"b ".repeat(100)}`;
      await store.appendMessage("c1", msg({ id: "u1", text: "faktura" }));
      await store.appendMessage("c1", msg({ id: "a1", role: "assistant", text: long }));
      const [hit] = await store.listConversations("needle");
      expect(hit?.snippet).toContain("NEEDLE middle");
      expect(hit?.snippet).not.toMatch(/\n/);
      expect(hit?.snippet?.length).toBeLessThanOrEqual(142);
      // title ("faktura") match is also a message match here -> snippet is the message text
      expect((await store.listConversations("faktura"))[0]?.snippet).toBe("faktura");
      expect(await store.listConversations("zzz")).toEqual([]);
      // no q -> no snippet
      expect((await store.listConversations())[0]).not.toHaveProperty("snippet");
    });

    it("title-only hit (custom title) has no snippet", async () => {
      await seed("c1", "obsah");
      await store.renameConversation("c1", "Rozpočet");
      const [hit] = await store.listConversations("rozpo");
      expect(hit?.conversationId).toBe("c1");
      expect(hit).not.toHaveProperty("snippet");
    });
  });
});
