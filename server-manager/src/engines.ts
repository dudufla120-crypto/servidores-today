import type {
  CompatibilityResult,
  Engine,
  EngineInfo,
  EngineVersion,
} from "../../api/types.js";
import { fetchJson, fetchText } from "./http.js";
import { compareVersions, parseMavenMetadataXml } from "./mojang.js";

export interface EngineSources {
  paperApiUrl: string;
  purpurApiUrl: string;
  fabricMetaUrl: string;
  forgePromoUrl: string;
  neoforgeMavenUrl: string;
  spigotFallbackDownload: string;
}

export const ENGINE_LIST: EngineInfo[] = [
  {
    id: "vanilla",
    label: "Vanilla",
    description: "Servidor original da Mojang",
    moddable: false,
    source: "https://piston-meta.mojang.com",
  },
  {
    id: "paper",
    label: "Paper",
    description: "Alto desempenho, o mais usado em servidores de plugins",
    moddable: true,
    source: "https://papermc.io",
  },
  {
    id: "spigot",
    label: "Spigot",
    description: "Motor clássico com a API Bukkit/Spigot",
    moddable: true,
    source: "https://www.spigotmc.org",
  },
  {
    id: "purpur",
    label: "Purpur",
    description: "Fork do Paper com configurações avançadas",
    moddable: true,
    source: "https://purpurmc.org",
  },
  {
    id: "fabric",
    label: "Fabric",
    description: "Leve e moderno, ideal para mods",
    moddable: true,
    source: "https://fabricmc.net",
  },
  {
    id: "forge",
    label: "Forge",
    description: "Motor clássico de mods",
    moddable: true,
    source: "https://files.minecraftforge.net",
  },
  {
    id: "neoforge",
    label: "NeoForge",
    description: "Sucessor da Forge, comunidade ativa",
    moddable: true,
    source: "https://neoforged.net",
  },
];

export function getEngineInfo(engine: Engine): EngineInfo {
  return ENGINE_LIST.find((e) => e.id === engine) ?? ENGINE_LIST[0];
}

interface PaperApiResponse {
  versions: Record<string, string[]>;
}

interface PaperFillBuild {
  id: number;
  time: string;
  channel: "STABLE" | "EXPERIMENTAL";
  downloads: {
    "server:default": { name: string; url: string; size: number };
  };
}

interface PurpurApiResponse {
  versions: string[] | Record<string, unknown>;
}

interface PurpurBuildsResponse {
  builds: { build: string; md5: string }[];
}

interface MinecraftVersionManifest {
  versions: { id: string; url: string }[];
}

interface MinecraftVersionDetails {
  downloads: { server: { url: string } };
}

interface FabricGameVersion {
  version: string;
  stable: boolean;
}

interface ForgePromotions {
  promos: Record<string, string>;
}

export async function listEngineVersions(
  engine: Engine,
  sources: EngineSources,
): Promise<EngineVersion[]> {
  switch (engine) {
    case "paper": {
      const data = await fetchJson<PaperApiResponse>(sources.paperApiUrl);
      const out: EngineVersion[] = [];
      for (const group of Object.values(data.versions)) {
        for (const v of group) {
          out.push({ id: v, stable: !/-(rc|pre|snapshot)/i.test(v) });
        }
      }
      return out.sort((a, b) => compareVersions(b.id, a.id));
    }
    case "purpur": {
      const data = await fetchJson<PurpurApiResponse>(sources.purpurApiUrl);
      const keys = Array.isArray(data.versions)
        ? data.versions
        : Object.keys(data.versions);
      return keys
        .map((v) => ({ id: v, stable: !/-(rc|pre|snapshot)/i.test(v) }))
        .sort((a, b) => compareVersions(b.id, a.id));
    }
    case "spigot": {
      return [];
    }
    case "fabric": {
      const list = await fetchJson<FabricGameVersion[]>(
        `${sources.fabricMetaUrl}/versions/game`,
      );
      return list
        .map((v) => ({ id: v.version, stable: v.stable }))
        .sort((a, b) => compareVersions(b.id, a.id));
    }
    case "forge": {
      const promo = await fetchJson<ForgePromotions>(sources.forgePromoUrl);
      const seen = new Set<string>();
      const out: EngineVersion[] = [];
      for (const key of Object.keys(promo.promos)) {
        const mc = key.split("-")[0];
        if (seen.has(mc)) continue;
        seen.add(mc);
        out.push({ id: mc, stable: true });
      }
      return out.sort((a, b) => compareVersions(b.id, a.id));
    }
    case "neoforge": {
      // O maven da NeoForge bloqueia User-Agents não reconhecidos; usa um
      // UA de navegador apenas para este endpoint (metadata público).
      const xml = await fetchText(sources.neoforgeMavenUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        },
      });
      const versions = parseMavenMetadataXml(xml);
      // NeoForge publica versões como 20.4.x, 21.0.x ..., que mapeiam para
      // versões do Minecraft (ex.: 20.4 -> 1.20.4). Extraímos o mapeamento.
      const seen = new Set<string>();
      const out: EngineVersion[] = [];
      for (const v of versions) {
        const parts = v.id.split(".");
        const mc = parts.length >= 2 ? `1.${parts[0]}.${parts[1]}` : v.id;
        if (seen.has(mc)) continue;
        seen.add(mc);
        out.push({ id: mc, stable: true });
      }
      return out.sort((a, b) => compareVersions(b.id, a.id));
    }
    case "vanilla":
    default:
      return [];
  }
}

export interface ResolvedDownload {
  url: string;
  fileName: string;
}

export async function resolveDownload(
  engine: Engine,
  mcVersion: string,
  sources: Pick<
    EngineSources,
    "paperApiUrl" | "purpurApiUrl" | "spigotFallbackDownload" | "fabricMetaUrl"
  >,
): Promise<ResolvedDownload> {
  switch (engine) {
    case "paper": {
      const api = sources.paperApiUrl.replace(/\/$/, "");
      const builds = await fetchJson<PaperFillBuild[]>(
        `${api}/versions/${mcVersion}/builds`,
      );
      const build = builds.find((b) => b.channel === "STABLE") ?? builds[0];
      if (!build) {
        throw new Error(`Paper não possui build publicada para ${mcVersion}`);
      }
      const dl = build.downloads["server:default"];
      return { url: dl.url, fileName: dl.name };
    }
    case "purpur": {
      const builds = await fetchJson<PurpurBuildsResponse>(
        `${sources.purpurApiUrl}/${mcVersion}/latest`,
      );
      const latest = builds.builds[0];
      return {
        url: `${sources.purpurApiUrl}/${mcVersion}/${latest.build}/download`,
        fileName: `purpur-${mcVersion}.jar`,
      };
    }
    case "vanilla": {
      const manifest = await fetchJson<MinecraftVersionManifest>(
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
      );
      const entry = manifest.versions.find((v) => v.id === mcVersion);
      if (!entry) throw new Error(`Vanilla não possui a versão ${mcVersion}`);
      const details = await fetchJson<MinecraftVersionDetails>(entry.url);
      return {
        url: details.downloads.server.url,
        fileName: `vanilla-${mcVersion}.jar`,
      };
    }
    case "spigot": {
      return {
        url: `${sources.spigotFallbackDownload}/${mcVersion}/spigot-${mcVersion}.jar`,
        fileName: `spigot-${mcVersion}.jar`,
      };
    }
    case "fabric": {
      const loaderUrl = `${sources.fabricMetaUrl}/versions/loader/${mcVersion}/`;
      const data = await fetchJson<{
        loader: { version: string }[];
        installer: { version: string; url: string }[];
      }>(loaderUrl);
      const loader = data.loader[0];
      const installer = data.installer[0];
      return {
        url: `${sources.fabricMetaUrl}/versions/loader/${mcVersion}/${loader.version}/${installer.version}/server/jar`,
        fileName: `fabric-${mcVersion}.jar`,
      };
    }
    case "forge":
    case "neoforge":
      throw new Error(
        `${getEngineInfo(engine).label} requer o instalador oficial (não há jar direto).`,
      );
  }
}

export async function checkCompatibility(
  engine: Engine,
  mcVersion: string,
  sources: EngineSources,
): Promise<CompatibilityResult> {
  const base: CompatibilityResult = {
    engine,
    mcVersion,
    compatible: false,
    checkedAt: new Date().toISOString(),
  };
  try {
    if (engine === "vanilla") {
      return { ...base, compatible: true };
    }
    const list = await listEngineVersions(engine, sources);
    const match = list.some((v) => v.id === mcVersion);
    if (!match) {
      return {
        ...base,
        reason: `Este motor não publicou build para Minecraft ${mcVersion}. Escolha uma versão da lista disponível.`,
      };
    }
    let downloadUrl: string | undefined;
    try {
      const d = await resolveDownload(engine, mcVersion, sources);
      downloadUrl = d.url;
    } catch {
      downloadUrl = undefined;
    }
    return { ...base, compatible: true, downloadUrl };
  } catch (err) {
    return {
      ...base,
      reason: `Não foi possível verificar a compatibilidade agora (${(err as Error).message}). Tente novamente em instantes.`,
    };
  }
}

export async function isEngineVersionAvailable(
  engine: Engine,
  mcVersion: string,
  sources: EngineSources,
): Promise<boolean> {
  const result = await checkCompatibility(engine, mcVersion, sources);
  return result.compatible;
}