import { describe, expect, it } from "vitest";
import {
  credentialMatchesKind,
  needsStoredCredential,
  operatorTokenMatchesKind,
} from "./credential-kind";

describe("credentialMatchesKind", () => {
  it("email requires a password (matches the email adapter's passwordOf)", () => {
    expect(credentialMatchesKind("email", { password: "p" })).toBe(true);
    expect(credentialMatchesKind("email", { token: "t" })).toBe(false);
  });

  it("slack/jira/github require a token (matches each adapter's tokenOf)", () => {
    for (const kind of ["slack", "jira", "github"] as const) {
      expect(credentialMatchesKind(kind, { token: "t" })).toBe(true);
      expect(credentialMatchesKind(kind, { password: "p" })).toBe(false);
    }
  });
});

describe("needsStoredCredential", () => {
  it("every kind but gitlab (glab holds the login) stores a credential", () => {
    expect(needsStoredCredential("gitlab")).toBe(false);
    for (const kind of ["slack", "email", "jira", "github", "calendar", "sentry"] as const) {
      expect(needsStoredCredential(kind)).toBe(true);
    }
  });

  it("a gitlab integration refuses any stored credential", () => {
    expect(credentialMatchesKind("gitlab", { token: "t" })).toBe(false);
    expect(credentialMatchesKind("gitlab", { password: "p" })).toBe(false);
  });
});

describe("operatorTokenMatchesKind", () => {
  it("slack-bot takes xoxb-, slack-app takes xapp-, a user token fits neither", () => {
    expect(operatorTokenMatchesKind("slack-bot", "xoxb-1")).toBe(true);
    expect(operatorTokenMatchesKind("slack-app", "xapp-1")).toBe(true);
    expect(operatorTokenMatchesKind("slack-bot", "xapp-1")).toBe(false);
    expect(operatorTokenMatchesKind("slack-app", "xoxp-1")).toBe(false);
  });
});
