import { resolve } from "node:path";

export interface AppConfig {
  port: number;
  apiKey: string;
  apiPublicMode: boolean;
  jwtSecret: string;
  serversDir: string;
  backupsDir: string;
  defaultMemoryMb: number;
  defaultPort: number;
  maxPort: number;
  versionsCacheFile: string;
  versionsCacheMaxAgeMs: number;
  paperApiUrl: string;
  purpurApiUrl: string;
  fabricMetaUrl: string;
  forgePromoUrl: string;
  neoforgeMavenUrl: string;
  spigotFallbackDownload: string;
  curseforgeApiKey?: string;
  fileSshHost?: string;
  fileSshPort?: number;
  fileSshUser?: string;
  fileSshPrivateKey?: string;
  fileSshPassphrase?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 4000),
    apiKey: env.API_KEY ?? "dev-api-key",
    apiPublicMode: env.API_PUBLIC_MODE === "true",
    jwtSecret: env.JWT_SECRET ?? "dev-secret",
    serversDir: resolve(env.SERVERS_DIR ?? "data/servidores"),
    backupsDir: resolve(env.BACKUPS_DIR ?? "data/backups"),
    defaultMemoryMb: Number(env.SERVER_DEFAULT_MEMORY_MB ?? 2048),
    defaultPort: Number(env.SERVER_DEFAULT_PORT_RANGE?.split("-")[0] ?? 25565),
    maxPort: Number(env.SERVER_DEFAULT_PORT_RANGE?.split("-")[1] ?? 25665),
    versionsCacheFile: env.VERSIONS_CACHE_FILE ?? "database/cache/versions.json",
    versionsCacheMaxAgeMs: Number(env.VERSIONS_CACHE_MAX_AGE_MS ?? 86400000),
    paperApiUrl: env.PAPER_API_URL ?? "https://fill.papermc.io/v3/projects/paper",
    purpurApiUrl: env.PURPUR_API_URL ?? "https://api.purpurmc.org/v2/purpur",
    fabricMetaUrl: env.FABRIC_META_URL ?? "https://meta.fabricmc.net/v2",
    forgePromoUrl: env.FORGE_PROMO_URL ?? "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json",
    neoforgeMavenUrl: env.NEOFORGE_MAVEN_URL ?? "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml",
    spigotFallbackDownload: env.SPIGOT_FALLBACK_DOWNLOAD ?? "https://download.spigotmc.org/spigot",
    curseforgeApiKey: env.CURSEFORGE_API_KEY,
    fileSshHost: env.FILE_SSH_HOST,
    fileSshPort: Number(env.FILE_SSH_PORT ?? 22),
    fileSshUser: env.FILE_SSH_USER,
    fileSshPrivateKey: env.FILE_SSH_PRIVATE_KEY,
    fileSshPassphrase: env.FILE_SSH_PASSPHRASE,
  };
}