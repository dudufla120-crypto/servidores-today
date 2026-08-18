import express, { Router } from "express";
import { join } from "node:path";
import { ENGINES, type Engine, type ServerConfig } from "../../api/types.js";
import { ENGINE_LIST, checkCompatibility } from "../../server-manager/src/engines.js";
import { createServer as doInstall } from "../../server-manager/src/install.js";
import { restartServer, sendCommand, startServer, stopServer } from "../../server-manager/src/process.js";
import { searchPlugins, installPlugin } from "../../plugin-manager/src/index.js";
import { searchMods, installMod } from "../../mod-manager/src/index.js";
import { deleteEntry, listFiles, readFileContent, writeFileEntry } from "../../file-manager/src/index.js";
import type { AppConfig } from "./config.js";
import { deleteServer, getServer, insertServer, listServers, setServerStatus } from "./db.js";
import type { ServerRow } from "./db.js";
import { versionStore } from "./versions.js";

export function buildRouter(config: AppConfig): Router {
  const router = Router();

  const rowToServer = (row: ServerRow) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    engine: row.engine,
    mcVersion: row.mc_version,
    status: row.status,
    memoryMb: row.memory_mb,
    port: row.port,
    installDir: row.install_dir,
    startedAt: row.started_at,
    createdAt: row.created_at,
  });

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  router.get("/engines", (_req, res) => {
    res.json({ engines: ENGINE_LIST });
  });

  router.get("/versions", async (_req, res, next) => {
    try {
      const cache = await versionStore.get(config);
      res.json({ generatedAt: cache.generatedAt, engines: cache.engines, minecraft: cache.minecraft });
    } catch (err) {
      next(err);
    }
  });

  router.get("/versions/:engine", async (req, res, next) => {
    try {
      const engine = req.params.engine as Engine;
      if (!ENGINES.includes(engine)) {
        res.status(400).json({ error: `Motor desconhecido: ${engine}` });
        return;
      }
      const cache = await versionStore.get(config);
      const all = req.query.all === "true";
      if (engine === "vanilla") {
        res.json({ engine, versions: all ? cache.minecraft.all : cache.minecraft.releases });
        return;
      }
      res.json({ engine, versions: cache.engines[engine] ?? [] });
    } catch (err) {
      next(err);
    }
  });

  router.get("/compatibility", async (req, res, next) => {
    try {
      const mcVersion = String(req.query.mcVersion ?? "");
      const engine = req.query.engine as Engine;
      if (!ENGINES.includes(engine)) {
        res.status(400).json({ error: "Parâmetros inválidos" });
        return;
      }
      const result = await checkCompatibility(engine, mcVersion, {
        paperApiUrl: config.paperApiUrl,
        purpurApiUrl: config.purpurApiUrl,
        fabricMetaUrl: config.fabricMetaUrl,
        forgePromoUrl: config.forgePromoUrl,
        neoforgeMavenUrl: config.neoforgeMavenUrl,
        spigotFallbackDownload: config.spigotFallbackDownload,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/servers", async (req, res, next) => {
    try {
      const body = req.body as Partial<ServerConfig>;
      if (!body.name || !body.engine || !body.mcVersion) {
        res.status(400).json({ error: "name, engine e mcVersion são obrigatórios" });
        return;
      }
      const engine = body.engine;
      if (!ENGINES.includes(engine)) {
        res.status(400).json({ error: `Motor desconhecido: ${engine}` });
        return;
      }
      const compat = await checkCompatibility(engine, body.mcVersion, {
        paperApiUrl: config.paperApiUrl,
        purpurApiUrl: config.purpurApiUrl,
        fabricMetaUrl: config.fabricMetaUrl,
        forgePromoUrl: config.forgePromoUrl,
        neoforgeMavenUrl: config.neoforgeMavenUrl,
        spigotFallbackDownload: config.spigotFallbackDownload,
      });
      if (!compat.compatible) {
        res.status(400).json({ error: `Combinação incompatível: ${engine} + ${body.mcVersion}. ${compat.reason ?? ""}` });
        return;
      }
      const port = Number(body.port ?? config.defaultPort);
      if (port < 1 || port > 65535 || port < config.defaultPort || port > config.maxPort) {
        res.status(400).json({ error: `Porta fora da faixa permitida (${config.defaultPort}-${config.maxPort})` });
        return;
      }
      const memoryMb = Number(body.memoryMb ?? config.defaultMemoryMb);
      const cfg: ServerConfig = {
        name: body.name,
        engine,
        mcVersion: body.mcVersion,
        memoryMb,
        port,
        maxPlayers: body.maxPlayers,
        motd: body.motd,
        onlineMode: body.onlineMode,
      };
      const installed = await doInstall(cfg, {
        serversDir: config.serversDir,
        backupsDir: config.backupsDir,
        paperApiUrl: config.paperApiUrl,
        purpurApiUrl: config.purpurApiUrl,
        fabricMetaUrl: config.fabricMetaUrl,
        spigotFallbackDownload: config.spigotFallbackDownload,
      });
      await insertServer(config, {
        id: installed.id,
        name: cfg.name,
        slug: installed.slug,
        engine,
        mcVersion: cfg.mcVersion,
        memoryMb,
        port,
        installDir: installed.installDir,
      });
      await setServerStatus(config, installed.id, "stopped");
      res.status(201).json({ serverId: installed.id, slug: installed.slug, installDir: installed.installDir });
    } catch (err) {
      next(err);
    }
  });

  router.get("/servers", async (_req, res, next) => {
    try {
      const rows = await listServers(config);
      res.json({ servers: rows.map(rowToServer) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/servers/:id", async (req, res, next) => {
    try {
      const row = await getServer(config, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Servidor não encontrado" });
        return;
      }
      res.json({ server: rowToServer(row) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/servers/:id/logs", async (req, res, next) => {
    try {
      const row = await getServer(config, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Servidor não encontrado" });
        return;
      }
      const logsDir = join(row.install_dir, "logs");
      const prefix = String(req.query.prefix ?? "");
      const max = Math.min(Number(req.query.max ?? 300), 2000);
      const candidates = ["console.log", "latest.log", "server.log", "server.err.log"]
        .map((f) => join(logsDir, f));
      const { readFile } = await import("node:fs/promises");
      const read = async (file: string) => {
        try {
          const content = await readFile(file, "utf-8");
          const lines = content.split("\n").filter((l) => !prefix || l.includes(prefix));
          return { file, lines: lines.slice(-max) };
        } catch {
          return null;
        }
      };
      const results = (await Promise.all(candidates.map(read))).filter(Boolean) as { file: string; lines: string[] }[];
      res.json({ logs: results });
    } catch (err) {
      next(err);
    }
  });

  router.post("/servers/:id/command", async (req, res, next) => {
    try {
      const row = await getServer(config, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Servidor não encontrado" });
        return;
      }
      const command = String(req.body?.command ?? "");
      if (!command.trim()) {
        res.status(400).json({ error: "Comando vazio" });
        return;
      }
      const sent = sendCommand(row.install_dir, command);
      if (!sent) {
        res.status(409).json({ error: "Servidor não está com console ativo. Inicie pelo painel." });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post("/servers/:id/start", async (req, res, next) => {
    try {
      const row = await getServer(config, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Servidor não encontrado" });
        return;
      }
      const started = await startServer(row.install_dir);
      if (!started.running) {
        res.status(500).json({ error: "O servidor não iniciou. Veja os logs em " + join(row.install_dir, "logs") });
        return;
      }
      await setServerStatus(config, row.id, "running");
      res.json({ ok: true, running: true });
    } catch (err) {
      next(err);
    }
  });

  router.post("/servers/:id/stop", async (req, res, next) => {
    try {
      const row = await getServer(config, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Servidor não encontrado" });
        return;
      }
      await stopServer(row.install_dir);
      await setServerStatus(config, row.id, "stopped");
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post("/servers/:id/restart", async (req, res, next) => {
    try {
      const row = await getServer(config, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Servidor não encontrado" });
        return;
      }
      const restarted = await restartServer(row.install_dir);
      if (!restarted.running) {
        res.status(500).json({ error: "O servidor não iniciou. Veja os logs em " + join(row.install_dir, "logs") });
        return;
      }
      await setServerStatus(config, row.id, "running");
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/servers/:id", async (req, res, next) => {
    try {
      const row = await getServer(config, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Servidor não encontrado" });
        return;
      }
      await stopServer(row.install_dir);
      const { removeServer } = await import("../../server-manager/src/install.js");
      await removeServer(row.install_dir);
      await deleteServer(config, row.id);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get("/servers/:id/files", async (req, res, next) => {
    try {
      const row = await getServer(config, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Servidor não encontrado" });
        return;
      }
      const path = typeof req.query.path === "string" ? req.query.path : ".";
      const files = await listFiles(row.install_dir, path, {
        host: config.fileSshHost ?? undefined,
        port: config.fileSshPort,
        username: config.fileSshUser ?? undefined,
        privateKeyPath: config.fileSshPrivateKey ?? undefined,
        passphrase: config.fileSshPassphrase ?? undefined,
      });
      res.json({ path, files });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/servers/:id/files", async (req, res, next) => {
    try {
      const row = await getServer(config, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Servidor não encontrado" });
        return;
      }
      const path = typeof req.query.path === "string" ? req.query.path : "";
      if (!path) {
        res.status(400).json({ error: "Informe ?path= para excluir" });
        return;
      }
      await deleteEntry(row.install_dir, path);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/servers/:id/files",
    express.raw({ type: "*/*", limit: "100mb" }),
    async (req, res, next) => {
      try {
        const row = await getServer(config, req.params.id);
        if (!row) {
          res.status(404).json({ error: "Servidor não encontrado" });
          return;
        }
        const path = typeof req.query.path === "string" ? req.query.path : "";
        if (!path) {
          res.status(400).json({ error: "Informe ?path= com o caminho do arquivo" });
          return;
        }
        if (!req.body || typeof req.body !== "object") {
          res.status(400).json({ error: "Envie o conteúdo do arquivo no body" });
          return;
        }
        const buf = req.body as Buffer;
        await writeFileEntry(row.install_dir, path, buf);
        res.json({ ok: true, path });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get("/servers/:id/files/content", async (req, res, next) => {
    try {
      const row = await getServer(config, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Servidor não encontrado" });
        return;
      }
      const path = typeof req.query.path === "string" ? req.query.path : "";
      if (!path) {
        res.status(400).json({ error: "Informe ?path=" });
        return;
      }
      const result = await readFileContent(row.install_dir, path);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get("/plugins/search", async (req, res, next) => {
    try {
      const q = String(req.query.q ?? "");
      const provider = String(req.query.provider ?? "modrinth") as "modrinth" | "hangar" | "spiget";
      const results = await searchPlugins(q, provider);
      res.json({ results });
    } catch (err) {
      next(err);
    }
  });

  router.post("/servers/:id/plugins", async (req, res, next) => {
    try {
      const row = await getServer(config, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Servidor não encontrado" });
        return;
      }
      const { downloadUrl, fileName } = req.body as { downloadUrl: string; fileName: string };
      const dest = await installPlugin(row.install_dir, downloadUrl, fileName);
      res.status(201).json({ installed: dest });
    } catch (err) {
      next(err);
    }
  });

  router.get("/mods/search", async (req, res, next) => {
    try {
      const q = String(req.query.q ?? "");
      const provider = String(req.query.provider ?? "modrinth") as "modrinth" | "curseforge";
      const results = await searchMods(q, provider, config.curseforgeApiKey);
      res.json({ results });
    } catch (err) {
      next(err);
    }
  });

  router.post("/servers/:id/mods", async (req, res, next) => {
    try {
      const row = await getServer(config, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Servidor não encontrado" });
        return;
      }
      const { downloadUrl, fileName } = req.body as { downloadUrl: string; fileName: string };
      const dest = await installMod(row.install_dir, downloadUrl, fileName);
      res.status(201).json({ installed: dest });
    } catch (err) {
      next(err);
    }
  });

  return router;
}