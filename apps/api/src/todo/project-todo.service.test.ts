import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectTodoService, pruneTodoLines } from "./project-todo.service";

const SAMPLE = [
  "# TODO",
  "1. [x] done one",
  "2. [ ] open",
  "   a. [x] sub done",
  "   b. [ ] sub open",
  "3. [x] done parent",
  "   a. [ ] orphaned sub",
  "4. [ ] last",
  "",
].join("\n");

describe("ProjectTodoService", () => {
  let dir: string;
  let svc: ProjectTodoService;
  const file = () => path.join(dir, "projects", "acme", "TODO.md");

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "ptodo-"));
    await fs.mkdir(path.dirname(file()), { recursive: true });
    await fs.writeFile(file(), SAMPLE);
    svc = new ProjectTodoService(dir);
  });
  afterEach(() => fs.rm(dir, { recursive: true, force: true }));

  it("lists top-level items positionally", async () => {
    expect(await svc.list("acme")).toEqual([
      { number: 1, text: "done one", done: true },
      { number: 2, text: "open", done: false },
      { number: 3, text: "done parent", done: true },
      { number: 4, text: "last", done: false },
    ]);
    expect(await svc.list("nope")).toEqual([]);
  });

  it("ticks one item in place and leaves the rest untouched", async () => {
    expect(await svc.setDone("acme", 4, true)).toEqual({ number: 4, text: "last", done: true });
    expect(await fs.readFile(file(), "utf8")).toBe(SAMPLE.replace("4. [ ] last", "4. [x] last"));
    expect(await svc.setDone("acme", 9, true)).toBeNull();
  });

  it("prunes done items (parent takes subs) and renumbers; pruneAll writes it", async () => {
    expect(pruneTodoLines(["# TODO", "1. [ ] a"])).toBeNull();
    expect(await svc.pruneAll()).toBe(4);
    expect(await fs.readFile(file(), "utf8")).toBe(
      ["# TODO", "1. [ ] open", "   a. [ ] sub open", "2. [ ] last", ""].join("\n"),
    );
  });
});
