import type { PluginSearchResult } from "../../api/types.js";
import { fetchJson } from "./http.js";

/**
 * Busca e instalação de MODS (client+server) a partir da Modrinth e da
 * CurseForge (opcional — requer CURSEFORGE_API_KEY).
 */
export type ModProvider = "modrinth" | "curseforge";

export async function searchMods(
  query: string,
  provider: ModProvider = "modrinth",
  curseforgeApiKey?: string,
  limit = 12,
): Promise<PluginSearchResult[]> {
  switch (provider) {
    case "modrinth":
      return searchModrinth(query, limit);
    case "curseforge":
      return searchCurseforge(query, curseforgeApiKey, limit);
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
    }[];
  }>(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=${limit}&facets=[["project_type:mod"]]`);
  return Promise.all(
    data.hits.map(async (h) => {
      let downloadUrl = "";
      try {
        const versions = await fetchJson<
          { files: { url: string; filename: string }[] }[]
        >(`https://api.modrinth.com/v2/project/${h.project_id}/version`);
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
        url: `https://modrinth.com/mod/${h.slug}`,
        downloadUrl,
        fileName: downloadUrl.split("/").pop() ?? `${h.slug}.jar`,
      };
    }),
  );
}

async function searchCurseforge(
  query: string,
  apiKey: string | undefined,
  limit: number,
): Promise<PluginSearchResult[]> {
  if (!apiKey) {
    return [];
  }
  const data = await fetchJson<{
    data: {
      id: number;
      name: string;
      slug: string;
      summary: string;
      downloadsCount: number;
      authors: { name: string }[];
      links: { websiteUrl: string };
    }[];
  }>(`https://api.curseforge.com/v1/mods/search?gameId=432&classId=6&searchFilter=${encodeURIComponent(query)}&pageSize=${limit}`, {
    headers: { "x-api-key": apiKey },
    timeoutMs: 15000,
  });
  return data.data.map((m) => ({
    provider: "curseforge",
    id: String(m.id),
    name: m.name,
    author: m.authors[0]?.name ?? "CurseForge",
    description: m.summary,
    downloads: m.downloadsCount,
    url: m.links.websiteUrl,
    fileName: `${m.slug}.jar`,
  }));
}

export async function installMod(
  serverInstallDir: string,
  downloadUrl: string,
  fileName: string,
): Promise<string> {
  const { join } = await import("node:path");
  const { mkdir } = await import("node:fs/promises");
  const { downloadFile } = await import("./http.js");
  const modsDir = join(serverInstallDir, "mods");
  await mkdir(modsDir, { recursive: true });
  const dest = join(modsDir, fileName);
  await downloadFile(downloadUrl, dest);
  return dest;
}