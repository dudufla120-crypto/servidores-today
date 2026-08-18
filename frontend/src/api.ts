import type {
  CompatibilityResult,
  Engine,
  EngineInfo,
  ModSearchResult,
  PluginSearchResult,
  ServerConfig,
} from "../../api/types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  return (await res.json()) as T;
}

export function fetchEngines(): Promise<{ engines: EngineInfo[] }> {
  return request<{ engines: EngineInfo[] }>("/engines");
}

export function fetchVersions(): Promise<{
  generatedAt: string;
  minecraft: { all: { id: string; type: string }[]; releases: { id: string; type: string }[] };
  engines: Record<string, { id: string; stable: boolean }[]>;
}> {
  return request("/versions");
}

export function fetchEngineVersions(
  engine: Engine,
  all = false,
): Promise<{ versions: { id: string; stable: boolean }[] }> {
  return request(`/versions/${engine}?all=${all}`);
}

export function fetchCompatibility(
  engine: Engine,
  mcVersion: string,
): Promise<CompatibilityResult> {
  return request(`/compatibility?engine=${engine}&mcVersion=${encodeURIComponent(mcVersion)}`);
}

export function createServer(config: ServerConfig): Promise<{ serverId: string; slug: string }> {
  return request("/servers", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export function listServers(): Promise<{ servers: unknown[] }> {
  return request("/servers");
}

export function startServer(id: string): Promise<{ ok: true }> {
  return request(`/servers/${id}/start`, { method: "POST" });
}

export function stopServer(id: string): Promise<{ ok: true }> {
  return request(`/servers/${id}/stop`, { method: "POST" });
}

export function restartServer(id: string): Promise<{ ok: true }> {
  return request(`/servers/${id}/restart`, { method: "POST" });
}

export function deleteServer(id: string): Promise<{ ok: true }> {
  return request(`/servers/${id}`, { method: "DELETE" });
}

export function fetchServerLogs(
  id: string,
  max = 300,
): Promise<{ logs: { file: string; lines: string[] }[] }> {
  return request(`/servers/${id}/logs?max=${max}`);
}

export function sendServerCommand(id: string, command: string): Promise<{ ok: true }> {
  return request(`/servers/${id}/command`, {
    method: "POST",
    body: JSON.stringify({ command }),
  });
}

export function fetchFiles(
  id: string,
  path = ".",
): Promise<{
  path: string;
  files: { name: string; path: string; type: "dir" | "file"; size: number; modifiedAt: string }[];
}> {
  return request(`/servers/${id}/files?path=${encodeURIComponent(path)}`);
}

export function deleteFile(id: string, path: string): Promise<{ ok: true }> {
  return request(`/servers/${id}/files?path=${encodeURIComponent(path)}`, { method: "DELETE" });
}

export function uploadFile(id: string, path: string, content: Blob): Promise<{ ok: true }> {
  return fetch(`${BASE}/servers/${id}/files?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: content,
  }).then(async (r) => {
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Erro ${r.status}`);
    }
    return (await r.json()) as { ok: true };
  });
}

export function fetchFileContent(
  id: string,
  path: string,
): Promise<{ content: string; truncated: boolean }> {
  return request(`/servers/${id}/files/content?path=${encodeURIComponent(path)}`);
}

export function searchPlugins(
  q: string,
  provider: string,
): Promise<{ results: PluginSearchResult[] }> {
  return request(`/plugins/search?q=${encodeURIComponent(q)}&provider=${provider}`);
}

export function installPlugin(
  id: string,
  downloadUrl: string,
  fileName: string,
): Promise<{ installed: string }> {
  return request(`/servers/${id}/plugins`, {
    method: "POST",
    body: JSON.stringify({ downloadUrl, fileName }),
  });
}

export function searchMods(
  q: string,
  provider: string,
): Promise<{ results: ModSearchResult[] }> {
  return request(`/mods/search?q=${encodeURIComponent(q)}&provider=${provider}`);
}

export function installMod(
  id: string,
  downloadUrl: string,
  fileName: string,
): Promise<{ installed: string }> {
  return request(`/servers/${id}/mods`, {
    method: "POST",
    body: JSON.stringify({ downloadUrl, fileName }),
  });
}

export function fetchServer(id: string): Promise<{
  server: {
    id: string;
    name: string;
    engine: string;
    mcVersion: string;
    status: string;
    port: number;
    memoryMb: number;
    installDir: string;
  };
}> {
  return request(`/servers/${id}`);
}