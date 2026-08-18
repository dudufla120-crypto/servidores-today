export const ENGINES = [
  "vanilla",
  "paper",
  "spigot",
  "purpur",
  "fabric",
  "forge",
  "neoforge",
] as const;

export type Engine = (typeof ENGINES)[number];

export interface EngineInfo {
  id: Engine;
  label: string;
  description: string;
  moddable: boolean;
  source: string;
}

export interface MinecraftVersion {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha" | string;
  releaseTime: string;
  url?: string;
}

export interface EngineVersion {
  id: string;
  stable: boolean;
  releaseTime?: string;
}

export interface VersionsCache {
  generatedAt: string;
  minecraft: {
    all: MinecraftVersion[];
    releases: MinecraftVersion[];
  };
  engines: Record<Engine, EngineVersion[]>;
}

export interface CompatibilityResult {
  engine: Engine;
  mcVersion: string;
  compatible: boolean;
  reason?: string;
  available?: EngineVersion;
  downloadUrl?: string;
  checkedAt: string;
}

export type ServerStatus = "installing" | "stopped" | "running" | "error" | "removing";

export interface ServerConfig {
  name: string;
  engine: Engine;
  mcVersion: string;
  memoryMb: number;
  port: number;
  maxPlayers?: number;
  motd?: string;
  onlineMode?: boolean;
}

export interface ServerRecord {
  id: string;
  name: string;
  slug: string;
  engine: Engine;
  mcVersion: string;
  status: ServerStatus;
  memoryMb: number;
  port: number;
  installDir: string;
  startedAt: string | null;
  createdAt: string;
}

export interface PluginSearchResult {
  provider: "modrinth" | "hangar" | "spiget" | "curseforge";
  id: string;
  name: string;
  author: string;
  description: string;
  downloads: number;
  url: string;
  fileName?: string;
}

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
  modifiedAt: string;
}