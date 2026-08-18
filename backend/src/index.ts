import "dotenv/config";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { loadConfig } from "./config.js";
import { ensureSchema, forceFileMode, pingDb, usesPostgres } from "./db.js";
import { buildRouter } from "./routes.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.header("authorization")?.replace(/^Bearer\s+/i, "");
    const publicPaths = ["/health", "/engines"];
    if (
      config.apiPublicMode ||
      publicPaths.some((p) => req.path === p) ||
      apiKey === config.apiKey
    ) {
      next();
      return;
    }
    res.status(401).json({ error: "Não autorizado. Envie Authorization: Bearer <API_KEY>." });
  });

  app.use("/api", buildRouter(config));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[api] Erro:", err.message);
    res.status(500).json({ error: err.message || "Erro interno" });
  });

  const dbUp = await pingDb(config).catch(() => false);
  if (!usesPostgres()) {
    console.log("[api] Banco local (JSON em data/db.json) — rode com PostgreSQL para produção.");
  } else if (!dbUp) {
    forceFileMode();
  } else {
    await ensureSchema(config);
    console.log("[api] Banco de dados conectado (PostgreSQL).");
  }

  app.listen(config.port, () => {
    console.log(`[api] Way Servidores API ouvindo em http://localhost:${config.port}/api`);
  });
}

main().catch((err) => {
  console.error("[api] Falha ao iniciar:", err);
  process.exit(1);
});