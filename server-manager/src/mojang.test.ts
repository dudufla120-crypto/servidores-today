import { describe, expect, it } from "vitest";
import { compareVersions, parseMavenMetadataXml } from "./mojang.js";

describe("compareVersions", () => {
  it("ordena versões do Minecraft corretamente", () => {
    expect(compareVersions("1.21.8", "1.21.7")).toBeGreaterThan(0);
    expect(compareVersions("1.20.4", "1.20.2")).toBeGreaterThan(0);
    expect(compareVersions("1.9.4", "1.10.2")).toBeLessThan(0);
    expect(compareVersions("1.21", "1.21.1")).toBeLessThan(0);
    expect(compareVersions("1.8.9", "1.8.9")).toBe(0);
  });
});

describe("parseMavenMetadataXml", () => {
  it("extrai e ordena versões do metadata da NeoForge", () => {
    const xml = `<?xml version="1.0"?>
<metadata>
  <groupId>net.neoforged</groupId>
  <artifactId>neoforge</artifactId>
  <versioning>
    <versions>
      <version>20.4.0-beta</version>
      <version>20.4.80</version>
      <version>21.0.1</version>
      <version>21.1.0</version>
    </versions>
  </versioning>
</metadata>`;
    const versions = parseMavenMetadataXml(xml).map((v) => v.id);
    expect(versions).toEqual(["21.1.0", "21.0.1", "20.4.80", "20.4.0-beta"]);
  });
});