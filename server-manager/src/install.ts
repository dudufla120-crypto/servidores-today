import { randomUUID } from "node:crypto";
import { mkdir, writeFile, access, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ServerConfig } from "../../api/types.js";
import { downloadFile } from "./http.js";
import { resolveDownload } from "./engines.js";

export interface InstallEnv {
  serversDir: string;
  backupsDir?: string;
  defaultMotd?: string;
  paperApiUrl: string;
  purpurApiUrl: string;
  fabricMetaUrl: string;
  spigotFallbackDownload: string;
}

export interface InstalledServer {
  id: string;
  slug: string;
  installDir: string;
  jarPath: string;
  startScript: string;
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || `server-${randomUUID().slice(0, 8)}`;
}

export function defaultServerProperties(config: ServerConfig): string {
  const lines = [
    `#gerado automaticamente pelo Way Servidores`,
    `server-port=${config.port}`,
    `motd=${config.motd ?? "Um servidor Way Servidores"}`,
    `max-players=${config.maxPlayers ?? 20}`,
    `online-mode=${config.onlineMode ?? true}`,
    `view-distance=10`,
    `spawn-protection=16`,
    `enable-command-block=false`,
    `enforce-secure-profile=true`,
    `level-name=world`,
    `generate-structures=true`,
    `difficulty=easy`,
    `gamemode=survival`,
  ];
  return lines.join("\n") + "\n";
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function createServer(
  config: ServerConfig,
  env: InstallEnv,
): Promise<InstalledServer> {
  const id = randomUUID();
  const slug = slugify(config.name);
  const installDir = join(env.serversDir, slug);
  const jarPath = join(installDir, "server.jar");

  if (await exists(installDir)) {
    throw new Error(`Já existe um servidor chamado "${config.name}" (${slug}).`);
  }

  await mkdir(installDir, { recursive: true });
  await mkdir(join(installDir, "plugins"), { recursive: true });
  await mkdir(join(installDir, "mods"), { recursive: true });

  await writeFile(
    join(installDir, "eula.txt"),
    "# eula.txt gerado pelo Way Servidores\neula=true\n",
    "utf-8",
  );
  await writeFile(
    join(installDir, "server.properties"),
    defaultServerProperties(config),
    "utf-8",
  );

  const resolved = await resolveDownload(config.engine, config.mcVersion, {
    paperApiUrl: env.paperApiUrl,
    purpurApiUrl: env.purpurApiUrl,
    fabricMetaUrl: env.fabricMetaUrl,
    spigotFallbackDownload: env.spigotFallbackDownload,
  });
  await downloadFile(resolved.url, jarPath);
  await writeFile(join(installDir, "version.json"), JSON.stringify(resolved, null, 2), "utf-8");

  const srcScript = [
    "#!/usr/bin/env bash",
    `cd "${installDir}"`,
    `java -Xms${config.memoryMb}M -Xmx${config.memoryMb}M -jar server.jar nogui`,
  ].join("\n") + "\n";
  const batScript = [
    "@echo off",
    `cd /d "${installDir}"`,
    `java -Xms${config.memoryMb}M -Xmx${config.memoryMb}M -jar server.jar nogui`,
  ].join("\r\n") + "\r\n";
  const startScript = join(
    installDir,
    process.platform === "win32" ? "start.bat" : "start.sh",
  );
  await writeFile(startScript, process.platform === "win32" ? batScript : srcScript, "utf-8");

  await writeFile(
    join(installDir, "README.txt"),
    [
      "Way Servidores - arquivos do servidor.",
      "Este diretório contém mundos, plugins, mods, logs e dados dos usuários.",
      "Ele vive NA VM de hospedagem — nunca é enviado para o GitHub.",
    ].join("\n") + "\n",
    "utf-8",
  );

  return { id, slug, installDir, jarPath, startScript };
}

export async function removeServer(installDir: string): Promise<void> {
  await rm(installDir, { recursive: true, force: true });
}

export function readServerProperties(installDir: string): Promise<string | null> {
  return readFile(join(installDir, "server.properties"), "utf-8").catch(() => null);
}

export async function memoryMbOf(installDir: string, fallback: number): Promise<number> {
  const content = await readServerProperties(installDir);
  if (!content) return fallback;
  const m = /-Xmx(\d+)M/.exec(content);
  return m ? Number(m[1]) : fallback;
}