/**
 * Worker responsável por manter a biblioteca de versões atualizada.
 *
 * Consulta automaticamente as fontes oficiais:
 *   - Mojang (piston-meta)      -> todas as versões do Minecraft
 *   - PaperMC                   -> versões do Paper
 *   - Purpur                    -> versões do Purpur
 *   - Fabric (meta.fabricmc.net)-> versões suportadas pelo Fabric
 *   - Forge (promotions_slim)   -> versões com Forge estável
 *   - NeoForge (maven)          -> versões com NeoForge
 *
 * Grava o resultado em database/cache/versions.json e repete o processo
 * a cada UPDATE_INTERVAL_MS (padrão: 6 horas). O backend lê essa cache.
 */
import { pathToFileURL } from "node:url";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ENGINE_LIST, listEngineVersions, type EngineSources } from "../../server-manager/src/engines.js";
import { classifyMinecraftVersions, fetchMinecraftVersions } from "../../server-manager/src/mojang.js";
import type { VersionsCache } from "../../api/types.js";

export function configFromEnv(env: NodeJS.ProcessEnv): {
  manifestUrl: string;
  cacheFile: string;
  intervalMs: number;
  sources: EngineSources;
} {
  return {
    manifestUrl: env.MC_MANIFEST_URL ?? "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
    cacheFile: env.VERSIONS_CACHE_FILE ?? "database/cache/versions.json",
    intervalMs: Number(env.UPDATE_INTERVAL_MS ?? 6 * 60 * 60 * 1000),
    sources: {
      paperApiUrl: env.PAPER_API_URL ?? "https://fill.papermc.io/v3/projects/paper",
      purpurApiUrl: env.PURPUR_API_URL ?? "https://api.purpurmc.org/v2/purpur",
      fabricMetaUrl: env.FABRIC_META_URL ?? "https://meta.fabricmc.net/v2",
      forgePromoUrl: env.FORGE_PROMO_URL ?? "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json",
      neoforgeMavenUrl: env.NEOFORGE_MAVEN_URL ?? "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml",
      spigotFallbackDownload: env.SPIGOT_FALLBACK_DOWNLOAD ?? "https://download.spigotmc.org/spigot",
    },
  };
}

export async function buildVersionsCache(cfg: ReturnType<typeof configFromEnv>): Promise<VersionsCache> {
  const minecraft = classifyMinecraftVersions(
    await fetchMinecraftVersions(cfg.manifestUrl),
  );

  const engines = {} as VersionsCache["engines"];
  await Promise.all(
    ENGINE_LIST.map(async (info) => {
      try {
        engines[info.id] = await listEngineVersions(info.id, cfg.sources);
      } catch (err) {
        console.error(`[worker] Falha ao atualizar versões do motor ${info.id}:`, (err as Error).message);
        engines[info.id] = [];
      }
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    minecraft,
    engines,
  };
}

export async function saveCache(cache: VersionsCache, file: string): Promise<void> {
  const target = resolve(file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(cache, null, 2), "utf-8");
  console.log(`[worker] Cache de versões atualizado em ${target}`);
}

export async function cacheAgeMs(file: string): Promise<number> {
  try {
    const s = await stat(resolve(file));
    return Date.now() - s.mtimeMs;
  } catch {
    return Infinity;
  }
}

export async function readCache(file: string): Promise<VersionsCache | null> {
  try {
    return JSON.parse(await readFile(resolve(file), "utf-8")) as VersionsCache;
  } catch {
    return null;
  }
}

export async function runOnce(): Promise<void> {
  const cfg = configFromEnv(process.env);
  const cache = await buildVersionsCache(cfg);
  await saveCache(cache, cfg.cacheFile);
}

export async function startLoop(): Promise<void> {
  const cfg = configFromEnv(process.env);
  const age = await cacheAgeMs(cfg.cacheFile);
  if (age > cfg.intervalMs) {
    await runOnce();
  } else {
    console.log(`[worker] Cache recente (${Math.round(age / 60000)} min) — primeira atualização agendada.`);
  }
  setInterval(() => void runOnce(), cfg.intervalMs);
  console.log(`[worker] Atualizando versões a cada ${Math.round(cfg.intervalMs / 60000)} minutos.`);
}

const isMain = (() => {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  startLoop().catch((err) => {
    console.error("[worker] Falha ao iniciar:", err);
    process.exit(1);
  });
}