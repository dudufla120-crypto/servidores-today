import { join } from "node:path";
import type { PluginSearchResult } from "../../api/types.js";
import { downloadFile, fetchJson } from "./http.js";

export type PluginProvider = "modrinth" | "hangar" | "spiget";

export async function searchPlugins(
  query: string,
  provider: PluginProvider = "modrinth",
  limit = 12,
): Promise<PluginSearchResult[]> {
  switch (provider) {
    case "modrinth":
      return searchModrinth(query, limit);
    case "hangar":
      return searchHangar(query, limit);
    case "spiget":
      return searchSpiget(query, limit);
    default:
      return [];
  }
}

async function searchModrinth(query: string, limit: number): Promise<PluginSearchResult[]> {
  const data = await fetchJson<{
    hits: {
      project_id: string;
      title: string;
      author: string;
      description: string;
      downloads: number;
      slug: string;
      latest_version?: string;
    }[];
  }>(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=${limit}&facets=[["project_type:plugin"]]`);
  return data.hits.map((h) => ({
    provider: "modrinth",
    id: h.project_id,
    name: h.title,
    author: h.author,
    description: h.description,
    downloads: h.downloads,
    url: `https://modrinth.com/plugin/${h.slug}`,
  }));
}

async function searchHangar(query: string, limit: number): Promise<PluginSearchResult[]> {
  const data = await fetchJson<{
    result: {
      name: string;
      namespace: { owner: string; slug: string };
      stats: { downloads: number };
      description: string;
    }[];
  }>(`https://hangar.papermc.io/api/v1/projects?q=${encodeURIComponent(query)}&limit=${limit}`);
  return data.result.map((p) => ({
    provider: "hangar",
    id: p.namespace.slug,
    name: p.name,
    author: p.namespace.owner,
    description: p.description ?? "",
    downloads: p.stats.downloads,
    url: `https://hangar.papermc.io/${p.namespace.owner}/${p.namespace.slug}`,
  }));
}

async function searchSpiget(query: string, limit: number): Promise<PluginSearchResult[]> {
  const data = await fetchJson<
    {
      id: number;
      name: string;
      author: { name: string };
      tag: string;
      downloads: number;
      file?: { type: string; size: number };
    }[]
  >(`https://api.spiget.org/v2/search/resources/${encodeURIComponent(query)}?size=${limit}&fields=id,name,author,tag,downloads,file`);
  return data.map((r) => ({
    provider: "spiget",
    id: String(r.id),
    name: r.name,
    author: r.author?.name ?? "Desconhecido",
    description: r.tag ?? "",
    downloads: r.downloads,
    url: `https://www.spigotmc.org/resources/${r.id}/`,
  }));
}

export async function installPlugin(
  serverInstallDir: string,
  downloadUrl: string,
  fileName: string,
): Promise<string> {
  const pluginsDir = join(serverInstallDir, "plugins");
  const dest = join(pluginsDir, fileName);
  await downloadFile(downloadUrl, dest);
  return dest;
}

export { downloadFile, fetchJson } from "./http.js";