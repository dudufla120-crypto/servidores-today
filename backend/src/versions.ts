import type { VersionsCache } from "../../api/types.js";
import type { AppConfig } from "./config.js";
import { buildVersionsCache, readCache, saveCache } from "../../workers/src/index.js";

export interface VersionStore {
  get(config: AppConfig): Promise<VersionsCache>;
  refresh(config: AppConfig): Promise<VersionsCache>;
}

class FileVersionStore implements VersionStore {
  private cached: VersionsCache | null = null;
  private cachedAt = 0;

  async get(config: AppConfig): Promise<VersionsCache> {
    if (this.cached && Date.now() - this.cachedAt < 60_000) {
      return this.cached;
    }
    const fromFile = await readCache(config.versionsCacheFile);
    if (fromFile) {
      this.cached = fromFile;
      this.cachedAt = Date.now();
      return fromFile;
    }
    return this.refresh(config);
  }

  async refresh(config: AppConfig): Promise<VersionsCache> {
    const next = await buildVersionsCache({
      manifestUrl: "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
      cacheFile: config.versionsCacheFile,
      intervalMs: config.versionsCacheMaxAgeMs,
      sources: {
        paperApiUrl: config.paperApiUrl,
        purpurApiUrl: config.purpurApiUrl,
        fabricMetaUrl: config.fabricMetaUrl,
        forgePromoUrl: config.forgePromoUrl,
        neoforgeMavenUrl: config.neoforgeMavenUrl,
        spigotFallbackDownload: config.spigotFallbackDownload,
      },
    });
    await saveCache(next, config.versionsCacheFile);
    this.cached = next;
    this.cachedAt = Date.now();
    return next;
  }
}

export const versionStore = new FileVersionStore();