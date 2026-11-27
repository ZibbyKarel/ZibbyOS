import { describe, expect, it } from "vitest";
import { LOGO_MAX_BYTES, LogoInputSchema } from "./common.schema";
import { UpdateCompanySchema } from "./companies/company.schema";

const uri = (mime: string, bytes: Uint8Array | string) =>
  `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]);
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
const ok = (v: string) => LogoInputSchema.safeParse(v).success;

describe("LogoInputSchema", () => {
  it("accepts png, jpeg, webp and svg by content", () => {
    expect(ok(uri("image/png", PNG))).toBe(true);
    expect(ok(uri("image/jpeg", JPEG))).toBe(true);
    expect(ok(uri("image/webp", WEBP))).toBe(true);
    expect(ok(uri("image/svg+xml", `<?xml version="1.0"?>\n${SVG}`))).toBe(true);
  });

  it("accepts a bundled root-relative path, rejects external/other URLs", () => {
    expect(ok("/avatars/x.png")).toBe(true);
    expect(ok("https://evil.example/x.png")).toBe(false);
    expect(ok("//evil.example/x.png")).toBe(false);
  });

  it("rejects content that does not match the declared type (sniffing)", () => {
    expect(ok(uri("image/png", "not an image at all"))).toBe(false);
    expect(ok(uri("image/png", JPEG))).toBe(false);
    expect(ok(uri("image/svg+xml", PNG))).toBe(false);
    expect(ok(uri("image/png", `<html>${SVG}</html>`))).toBe(false);
  });

  it("rejects disallowed types such as gif and text/html", () => {
    expect(ok(uri("image/gif", "GIF89a....."))).toBe(false);
    expect(ok(uri("text/html", SVG))).toBe(false);
  });

  it("rejects images over 512 KB", () => {
    const big = Buffer.concat([Buffer.from(PNG), Buffer.alloc(LOGO_MAX_BYTES)]);
    expect(ok(uri("image/png", big))).toBe(false);
  });

  it.each([
    ["script tag", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ["event handler", '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"/>'],
    ["javascript: url", '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:x()"/></svg>'],
    ["foreignObject", '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>'],
  ])("rejects an svg with a %s", (_n, svg) => {
    expect(ok(uri("image/svg+xml", svg))).toBe(false);
  });

  it("is applied to entity update bodies; null clears", () => {
    expect(UpdateCompanySchema.safeParse({ logo: null }).success).toBe(true);
    expect(UpdateCompanySchema.safeParse({ logo: uri("image/png", "nope") }).success).toBe(false);
  });
});
