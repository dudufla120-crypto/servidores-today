import { readdir, stat, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { FileEntry } from "../../api/types.js";

export interface FileManagerConfig {
  host?: string;
  port?: number;
  username?: string;
  privateKeyPath?: string;
  passphrase?: string;
}

/**
 * Lista o conteúdo de um diretório de um servidor Minecraft.
 * - Sem config SSH: acessa o disco local (painel na mesma VM dos servers).
 * - Com config SSH: acessa a VM remota via SFTP.
 */
export async function listFiles(
  serverInstallDir: string,
  relativePath = ".",
  ssh?: FileManagerConfig,
): Promise<FileEntry[]> {
  if (ssh?.host) {
    return listFilesSsh(ssh, serverInstallDir, relativePath);
  }
  return listFilesLocal(serverInstallDir, relativePath);
}

async function listFilesLocal(
  serverInstallDir: string,
  relativePath: string,
): Promise<FileEntry[]> {
  const base = join(serverInstallDir, relativePath);
  const entries = await readdir(base, { withFileTypes: true });
  const out: FileEntry[] = [];
  for (const e of entries) {
    const full = join(base, e.name);
    let size = 0;
    let modifiedAt = "";
    if (e.isFile() || e.isDirectory()) {
      try {
        const s = await stat(full);
        size = e.isFile() ? s.size : 0;
        modifiedAt = s.mtime.toISOString();
      } catch {
        modifiedAt = "";
      }
    }
    out.push({
      name: e.name,
      path: join(relativePath, e.name),
      type: e.isDirectory() ? "dir" : "file",
      size,
      modifiedAt,
    });
  }
  return out.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1,
  );
}

function listFilesSsh(
  ssh: FileManagerConfig,
  serverInstallDir: string,
  relativePath: string,
): Promise<FileEntry[]> {
  return new Promise((resolvePromise, reject) => {
    void (async () => {
      const { Client } = await import("ssh2");
      const { readFile } = await import("node:fs/promises");
      const client = new Client();
      const remoteDir = `${serverInstallDir}/${relativePath}`.replace(/\/{2,}/g, "/");
      client
        .on("ready", () => {
          client.sftp((err, sftp) => {
            if (err) {
              client.end();
              reject(err);
              return;
            }
            sftp.readdir(remoteDir, (err2, list) => {
              if (err2) {
                client.end();
                reject(err2);
                return;
              }
              const out: FileEntry[] = (list ?? []).map((item) => ({
                name: item.filename,
                path: `${relativePath}/${item.filename}`,
                type: (item.attrs.isDirectory() ? "dir" : "file") as "dir" | "file",
                size: item.attrs.size ?? 0,
                modifiedAt: item.attrs.mtime
                  ? new Date((item.attrs.mtime as number) * 1000).toISOString()
                  : "",
              }));
              client.end();
              resolvePromise(out);
            });
          });
        })
        .on("error", reject)
        .connect({
          host: ssh.host as string,
          port: ssh.port ?? 22,
          username: ssh.username as string,
          privateKey: ssh.privateKeyPath ? await readFile(ssh.privateKeyPath, "utf-8") : undefined,
          passphrase: ssh.passphrase,
        });
    })();
  });
}

/**
 * Normaliza um caminho relativo para dentro do diretório do servidor,
 * impedindo path traversal (ex.: ../../windows/system32).
 */
export function resolveEntry(serverInstallDir: string, relativePath: string): string {
  const base = resolve(serverInstallDir);
  const target = resolve(base, relativePath || ".");
  if (target !== base && !target.startsWith(base + "\\") && !target.startsWith(base + "/")) {
    throw new Error("Caminho fora do diretório do servidor");
  }
  return target;
}

export async function deleteEntry(serverInstallDir: string, relativePath: string): Promise<void> {
  const target = resolveEntry(serverInstallDir, relativePath);
  if (target === resolve(serverInstallDir)) {
    throw new Error("Não é possível excluir a raiz do servidor");
  }
  await rm(target, { recursive: true, force: true });
}

export async function writeFileEntry(
  serverInstallDir: string,
  relativePath: string,
  content: Buffer,
): Promise<void> {
  const target = resolveEntry(serverInstallDir, relativePath);
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, content);
}

export async function readFileContent(
  serverInstallDir: string,
  relativePath: string,
  maxBytes = 500_000,
): Promise<{ content: string; truncated: boolean }> {
  const target = resolveEntry(serverInstallDir, relativePath);
  const s = await stat(target);
  if (!s.isFile()) {
    throw new Error("Não é um arquivo");
  }
  if (s.size > 5_000_000) {
    throw new Error("Arquivo muito grande para visualizar");
  }
  const buf = await readFile(target);
  return {
    content: buf.toString("utf-8").slice(0, maxBytes),
    truncated: buf.length > maxBytes,
  };
}