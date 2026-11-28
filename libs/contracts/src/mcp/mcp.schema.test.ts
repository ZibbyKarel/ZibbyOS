import { describe, expect, it } from "vitest";
import { isExclusiveMcpServer } from "./mcp.schema";

const stdio = (args: string[], exclusive?: boolean) => ({
  type: "stdio" as const,
  args,
  ...(exclusive === undefined ? {} : { exclusive }),
});

describe("isExclusiveMcpServer", () => {
  it("detects a persistent browser profile in a shell-wrapped command", () => {
    expect(
      isExclusiveMcpServer(
        stdio(["-c", 'exec playwright-mcp --user-data-dir "$HOME/profiles/mw" --foo']),
      ),
    ).toBe(true);
  });

  it("detects a bare and an = form of the flag", () => {
    expect(isExclusiveMcpServer(stdio(["--user-data-dir", "/p"]))).toBe(true);
    expect(isExclusiveMcpServer(stdio(["--user-data-dir=/p"]))).toBe(true);
  });

  it("is not exclusive when --isolated is also set or the flag is absent", () => {
    expect(isExclusiveMcpServer(stdio(["--user-data-dir", "/p", "--isolated"]))).toBe(false);
    expect(isExclusiveMcpServer(stdio(["--headless"]))).toBe(false);
    expect(isExclusiveMcpServer({ type: "stdio" })).toBe(false);
  });

  it("lets an explicit exclusive flag win either way", () => {
    expect(isExclusiveMcpServer(stdio(["--headless"], true))).toBe(true);
    expect(isExclusiveMcpServer(stdio(["--user-data-dir", "/p"], false))).toBe(false);
  });

  it("never auto-detects a remote transport", () => {
    expect(isExclusiveMcpServer({ type: "http", args: ["--user-data-dir", "/p"] })).toBe(false);
  });
});
