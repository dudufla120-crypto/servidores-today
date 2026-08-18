import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Pool } from "pg";
import type { AppConfig } from "./config.js";

let pool: Pool | null = null;
let fileDb: FileDb | null = null;
let fileOnly = false;

export interface ServerRow {
  id: string;
  name: string;
  slug: string;
  engine: string;
  mc_version: string;
  status: string;
  memory_mb: number;
  port: number;
  install_dir: string;
  created_at: string;
  started_at: string | null;
}

interface FileDbData {
  servers: ServerRow[];
}

/**
 * Banco local (arquivo JSON) usado quando DATABASE_URL não está configurado.
 * Perfeito para desenvolvimento; em produção use PostgreSQL.
 */
class FileDb {
  private file: string;
  private data: FileDbData;

  constructor(file: string) {
    this.file = resolve(file);
    this.data = { servers: [] };
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, "utf-8");
      this.data = JSON.parse(raw) as FileDbData;
      if (!Array.isArray(this.data.servers)) this.data.servers = [];
    } catch {
      this.data = { servers: [] };
    }
  }

  private async save(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify(this.data, null, 2), "utf-8");
  }

  async list(): Promise<ServerRow[]> {
    await this.load();
    return [...this.data.servers].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async get(id: string): Promise<ServerRow | null> {
    await this.load();
    return this.data.servers.find((s) => s.id === id) ?? null;
  }

  async insert(row: ServerRow): Promise<void> {
    await this.load();
    this.data.servers.push(row);
    await this.save();
  }

  async setStatus(id: string, status: string): Promise<void> {
    await this.load();
    const s = this.data.servers.find((x) => x.id === id);
    if (s) {
      s.status = status;
      if (status === "running") s.started_at = new Date().toISOString();
      if (status === "stopped") s.started_at = null;
      await this.save();
    }
  }

  async remove(id: string): Promise<void> {
    await this.load();
    this.data.servers = this.data.servers.filter((s) => s.id !== id);
    await this.save();
  }
}

function getFileDb(_config: AppConfig): FileDb {
  if (!fileDb) {
    fileDb = new FileDb(process.env.DB_FILE ?? "data/db.json");
  }
  return fileDb;
}

export function usesPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL) && !fileOnly;
}

/**
 * Mantém o sistema utilizável mesmo quando DATABASE_URL existe mas o
 * PostgreSQL não está acessível: passa a usar o banco local em JSON.
 */
export function forceFileMode(): void {
  fileOnly = true;
  console.warn("[db] PostgreSQL indisponível — usando banco local em JSON (data/db.json).");
}

export function getPool(_config: AppConfig): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
    pool.on("error", (err) => {
      console.error("Erro inesperado no pool do banco:", err.message);
    });
  }
  return pool;
}

export async function pingDb(_config: AppConfig): Promise<boolean> {
  if (!usesPostgres()) return true;
  try {
    await getPool(_config).query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function ensureSchema(_config: AppConfig): Promise<void> {
  if (!usesPostgres()) return;
  await getPool(_config).query(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      engine TEXT NOT NULL,
      mc_version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'installing',
      memory_mb INTEGER NOT NULL DEFAULT 2048,
      port INTEGER NOT NULL,
      install_dir TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      started_at TIMESTAMPTZ
    )
  `);
}

export async function insertServer(
  config: AppConfig,
  server: {
    id: string;
    name: string;
    slug: string;
    engine: string;
    mcVersion: string;
    memoryMb: number;
    port: number;
    installDir: string;
  },
): Promise<void> {
  if (!usesPostgres()) {
    await getFileDb(config).insert({
      id: server.id,
      name: server.name,
      slug: server.slug,
      engine: server.engine,
      mc_version: server.mcVersion,
      status: "installing",
      memory_mb: server.memoryMb,
      port: server.port,
      install_dir: server.installDir,
      created_at: new Date().toISOString(),
      started_at: null,
    });
    return;
  }
  const client = await getPool(config).connect();
  try {
    await client.query(
      `INSERT INTO servers (id, name, slug, engine, mc_version, memory_mb, port, status, install_dir)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'installing', $8)`,
      [server.id, server.name, server.slug, server.engine, server.mcVersion, server.memoryMb, server.port, server.installDir],
    );
  } finally {
    client.release();
  }
}

export async function listServers(config: AppConfig): Promise<ServerRow[]> {
  if (!usesPostgres()) {
    return getFileDb(config).list();
  }
  const db = getPool(config);
  const result = await db.query(
    `SELECT * FROM servers ORDER BY created_at DESC`,
  );
  return result.rows as ServerRow[];
}

export async function getServer(config: AppConfig, id: string): Promise<ServerRow | null> {
  if (!usesPostgres()) {
    return getFileDb(config).get(id);
  }
  const db = getPool(config);
  const result = await db.query(`SELECT * FROM servers WHERE id = $1`, [id]);
  return (result.rows[0] as ServerRow) ?? null;
}

export async function setServerStatus(
  config: AppConfig,
  id: string,
  status: string,
): Promise<void> {
  if (!usesPostgres()) {
    await getFileDb(config).setStatus(id, status);
    return;
  }
  await getPool(config).query(`UPDATE servers SET status = $1 WHERE id = $2`, [status, id]);
}

export async function deleteServer(config: AppConfig, id: string): Promise<void> {
  if (!usesPostgres()) {
    await getFileDb(config).remove(id);
    return;
  }
  await getPool(config).query(`DELETE FROM servers WHERE id = $1`, [id]);
}