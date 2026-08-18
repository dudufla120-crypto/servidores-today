import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { appendFile, readFile, rm, mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const require = createRequire(import.meta.url);

interface PtyLike {
  pid: number;
  write(data: string): void;
  onData(cb: (data: string) => void): void;
  kill(signal?: string): void;
}

const ptyTerminals = new Map<string, PtyLike>();

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function pidFile(installDir: string): string {
  return join(installDir, ".server.pid");
}

export async function getPid(installDir: string): Promise<number | null> {
  try {
    const raw = await readFile(pidFile(installDir), "utf-8");
    const pid = Number(raw.trim());
    return Number.isInteger(pid) ? pid : null;
  } catch {
    return null;
  }
}

/**
 * Resolve o script de inicialização. Em Windows, gera o start.bat a
 * partir do start.sh quando ele ainda não existe.
 */
async function startScriptPath(installDir: string): Promise<string> {
  if (process.platform !== "win32") {
    return join(installDir, "start.sh");
  }
  const bat = join(installDir, "start.bat");
  try {
    await access(bat);
    return bat;
  } catch {
    const sh = join(installDir, "start.sh");
    const shContent = await readFile(sh, "utf-8").catch(() => "");
    const javaLine = shContent.split("\n").find((l) => l.startsWith("java "));
    const batContent =
      ["@echo off", `cd /d "${installDir}"`, javaLine ?? "java -Xmx1024M -Xmx1024M -jar server.jar nogui"].join("\r\n") + "\r\n";
    await writeFile(bat, batContent, "utf-8");
    return bat;
  }
}

export async function startServer(installDir: string): Promise<{ running: boolean; pid?: number }> {
  const existing = await getPid(installDir);
  if (existing && isAlive(existing)) {
    return { running: true, pid: existing };
  }
  const script = await startScriptPath(installDir);
  const logsDir = join(installDir, "logs");
  await mkdir(logsDir, { recursive: true });
  const consoleFile = join(logsDir, "console.log");

  const pty = require("node-pty") as {
    spawn(file: string, args: string[], opts: { cols: number; rows: number; cwd: string; name: string }): PtyLike;
  };
  const terminal = pty.spawn(
    process.platform === "win32" ? "cmd.exe" : "bash",
    process.platform === "win32" ? ["/c", script] : [script],
    { cols: 200, rows: 80, cwd: installDir, name: "way-console" },
  );
  terminal.onData((data) => {
    void appendFile(consoleFile, data, "utf-8").catch(() => undefined);
  });
  ptyTerminals.set(installDir, terminal);
  await writeFile(pidFile(installDir), String(terminal.pid), "utf-8");
  return { running: true, pid: terminal.pid };
}

export async function stopServer(installDir: string): Promise<{ running: boolean }> {
  const pid = await getPid(installDir);
  if (!pid) return { running: false };
  if (!isAlive(pid)) {
    ptyTerminals.delete(installDir);
    await rm(pidFile(installDir), { force: true });
    return { running: false };
  }
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
  } else {
    spawnSync("kill", ["-TERM", String(pid)]);
  }
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (!isAlive(pid)) break;
  }
  ptyTerminals.delete(installDir);
  await rm(pidFile(installDir), { force: true });
  return { running: false };
}

export async function restartServer(installDir: string): Promise<{ running: boolean; pid?: number }> {
  await stopServer(installDir);
  return startServer(installDir);
}

export async function getStatus(installDir: string): Promise<{ running: boolean; pid?: number }> {
  const pid = await getPid(installDir);
  if (pid && isAlive(pid)) return { running: true, pid };
  return { running: false };
}

export function sendCommand(installDir: string, command: string): boolean {
  const terminal = ptyTerminals.get(installDir);
  if (!terminal) return false;
  try {
    terminal.write(command.replace(/\r?\n/g, "").trim() + "\r");
    return true;
  } catch {
    return false;
  }
}