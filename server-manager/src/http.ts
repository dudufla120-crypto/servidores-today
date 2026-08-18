const UA = "way-servidores/1.0 (https://github.com/way-servidores/way-servidores)";

/**
 * Chamadas HTTP com timeout para as APIs externas (fontes oficiais).
 */
export interface FetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, ...(options.headers ?? {}) },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ao acessar ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(
  url: string,
  options: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, ...(options.headers ?? {}) },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ao acessar ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadFile(url: string, dest: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA },
    });
    if (!res.ok) {
      throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const { writeFile } = await import("node:fs/promises");
    await writeFile(dest, buf);
  } finally {
    clearTimeout(timer);
  }
}