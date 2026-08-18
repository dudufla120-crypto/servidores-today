import type { EngineVersion, MinecraftVersion } from "../../api/types.js";
import { fetchJson } from "./http.js";

interface MojangManifest {
  latest: { release: string; snapshot: string };
  versions: { id: string; type: string; releaseTime: string; url: string }[];
}

export async function fetchMinecraftVersions(
  manifestUrl: string,
): Promise<MinecraftVersion[]> {
  const manifest = await fetchJson<MojangManifest>(manifestUrl);
  return manifest.versions.map((v) => ({
    id: v.id,
    type: v.type,
    releaseTime: v.releaseTime,
    url: v.url,
  }));
}

export function classifyMinecraftVersions(list: MinecraftVersion[]): {
  all: MinecraftVersion[];
  releases: MinecraftVersion[];
} {
  const sorted = [...list].sort((a, b) =>
    b.releaseTime.localeCompare(a.releaseTime),
  );
  return {
    all: sorted,
    releases: sorted.filter((v) => v.type === "release"),
  };
}

export function parseMavenMetadataXml(xml: string): EngineVersion[] {
  const versions: EngineVersion[] = [];
  const re = /<version>([^<]+)<\/version>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const v = m[1];
    if (!/^\d/.test(v)) continue;
    versions.push({
      id: v,
      stable: !/[.-](alpha|beta|rc|snapshot)/i.test(v),
    });
  }
  return versions.sort((a, b) => compareVersions(b.id, a.id));
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((s) => (isNaN(Number(s)) ? s : Number(s)));
  const pb = b.split(/[.-]/).map((s) => (isNaN(Number(s)) ? s : Number(s)));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (typeof x === "number" && typeof y === "number") {
      if (x !== y) return x - y;
    } else {
      const sx = String(x);
      const sy = String(y);
      const c = sx.localeCompare(sy);
      if (c !== 0) return c;
    }
  }
  return 0;
}