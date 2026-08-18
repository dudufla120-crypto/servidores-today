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
  return Promise.all(
    data.hits.map(async (h) => {
      let downloadUrl = "";
      try {
        const versions = await fetchJson<
          { files: { url: string; filename: string }[] }[]
        >(`https://api.modrinth.com/v2/project/${h.project_id}/version?loaders=["paper","spigot","bukkit"]`);
        const p = versions[0]?.files?.[0];
        downloadUrl = p?.url ?? "";
      } catch {
        downloadUrl = "";
      }
      return {
        provider: "modrinth",
        id: h.project_id,
        name: h.title,
        author: h.author,
        description: h.description,
        downloads: h.downloads,
        url: `https://modrinth.com/plugin/${h.slug}`,
        downloadUrl,
        fileName: downloadUrl.split("/").pop() ?? `${h.slug}.jar`,
      };
    }),
  );
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
  return Promise.all(
    data.result.map(async (p) => {
      let downloadUrl = "";
      try {
        const versions = await fetchJson<
          { result: { download_url: string; name: string }[] }[]
        >(`https://hangar.papermc.io/api/v1/projects/${p.namespace.owner}/${p.namespace.slug}/versions?limit=1&channel=Release`);
        const v = versions[0]?.result?.[0];
        downloadUrl = v?.download_url ?? "";
      } catch {
        downloadUrl = "";
      }
      return {
        provider: "hangar",
        id: p.namespace.slug,
        name: p.name,
        author: p.namespace.owner,
        description: p.description ?? "",
        downloads: p.stats.downloads,
        url: `https://hangar.papermc.io/${p.namespace.owner}/${p.namespace.slug}`,
        downloadUrl,
        fileName: downloadUrl.split("/").pop() ?? `${p.namespace.slug}.jar`,
      };
    }),
  );
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
    downloadUrl: `https://api.spiget.org/v2/resources/${r.id}/download`,
    fileName: `${r.id}-${r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.jar`,
  }));
}

export async function installPlugin(
  serverInstallDir: string,
  downloadUrl: string,
  fileName: string,
): Promise<string> {
  const { mkdir } = await import("node:fs/promises");
  const pluginsDir = join(serverInstallDir, "plugins");
  await mkdir(pluginsDir, { recursive: true });
  const dest = join(pluginsDir, fileName);
  await downloadFile(downloadUrl, dest);
  return dest;
}

export { downloadFile, fetchJson } from "./http.js";