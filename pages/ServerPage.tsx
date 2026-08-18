import { useEffect, useRef, useState } from "react";
import {
  deleteFile,
  deleteServer,
  fetchFileContent,
  fetchFiles,
  fetchServer,
  fetchServerLogs,
  restartServer,
  sendServerCommand,
  startServer,
  stopServer,
  uploadFile,
} from "../frontend/src/api";

type Tab = "console" | "files";

export function ServerPage({ id, onBack }: { id: string; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("console");
  const [server, setServer] = useState<
    | {
        id: string;
        name: string;
        engine: string;
        mcVersion: string;
        status: string;
        port: number;
        memoryMb: number;
        installDir: string;
      }
    | null
  >(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [files, setFiles] = useState<
    { name: string; path: string; type: "dir" | "file"; size: number }[]
  >([]);
  const [filesPath, setFilesPath] = useState(".");
  const [command, setCommand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<"all" | "errors">("all");
  const [history, setHistory] = useState<string[]>([]);
  const historyIdx = useRef(-1);
  const consoleRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<{ path: string; content: string; truncated: boolean } | null>(null);

  const reload = () => {
    fetchServer(id)
      .then((r) => setServer(r.server))
      .catch((e: Error) => setError(e.message));
  };

  useEffect(() => {
    reload();
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      fetchServerLogs(id, 400)
        .then(({ logs: filesLog }) => {
          const all = filesLog.flatMap((f) => f.lines);
          if (all.length) setLogs(all);
        })
        .catch(() => undefined);
    }, 3000);
    return () => clearInterval(t);
  }, [tab]);

  useEffect(() => {
    if (tab === "files") {
      fetchFiles(id, filesPath)
        .then((r) => setFiles(r.files))
        .catch((e: Error) => setError(e.message));
    }
  }, [tab, filesPath]);

  useEffect(() => {
    if (autoScroll) {
      consoleRef.current?.scrollTo(0, consoleRef.current.scrollHeight);
    }
  }, [logs, autoScroll]);

  const sendCmd = () => {
    const cmd = command.trim();
    if (!cmd) return;
    sendServerCommand(id, cmd)
      .then(() => {
        setHistory((h) => [...h, cmd].slice(-20));
        historyIdx.current = -1;
        setCommand("");
      })
      .catch((e: Error) => setError(e.message));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      sendCmd();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = historyIdx.current < 0 ? history.length - 1 : Math.max(0, historyIdx.current - 1);
      if (history[idx]) {
        historyIdx.current = idx;
        setCommand(history[idx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = historyIdx.current + 1;
      if (history[idx]) {
        historyIdx.current = idx;
        setCommand(history[idx]);
      } else {
        historyIdx.current = -1;
        setCommand("");
      }
    }
  };

  const filteredLogs = logs.filter((l) => (filter === "errors" ? /(error|fatal|exception|warn|erro)/i.test(l) : true));
  const playerMatch = logs.join("\n").match(/There are (\d+) of a max of (\d+) players online/i);
  const players = playerMatch ? `${playerMatch[1]}/${playerMatch[2]}` : null;

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.join("\n")).catch(() => undefined);
  };

  const clearLogs = () => setLogs([]);

  const refreshFiles = () =>
    fetchFiles(id, filesPath)
      .then((r) => setFiles(r.files))
      .catch((e: Error) => setError(e.message));

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;
    void (async () => {
      try {
        for (const file of selected) {
          const target = filesPath === "." ? file.name : `${filesPath}/${file.name}`;
          await uploadFile(id, target, file);
        }
        await refreshFiles();
      } catch (err) {
        setError((err as Error).message);
      }
      e.target.value = "";
    })();
  };

  const onNewFile = () => {
    const name = window.prompt("Nome do novo arquivo (ex.: ban.yml):");
    if (!name) return;
    void (async () => {
      try {
        const target = filesPath === "." ? name : `${filesPath}/${name}`;
        await uploadFile(id, target, new Blob([]));
        await refreshFiles();
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  };

  const removeFile = (path: string, type: "dir" | "file") => {
    if (!window.confirm(`Excluir ${type === "dir" ? "a pasta" : "o arquivo"} "${path}"? Essa ação é permanente.`)) return;
    deleteFile(id, path)
      .then(refreshFiles)
      .catch((e: Error) => setError(e.message));
  };

  const openFile = (path: string, size: number) => {
    if (size > 5_000_000) {
      setError("Arquivo muito grande para visualizar");
      return;
    }
    fetchFileContent(id, path)
      .then((r) => setViewing({ path, content: r.content, truncated: r.truncated }))
      .catch((e: Error) => setError(e.message));
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fmt = (bytes: number) =>
    bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm font-medium text-way-600 hover:text-way-700"
        >
          ← Voltar
        </button>
        <div className="flex items-center gap-2">
          {["Iniciar", "Parar", "Reiniciar"].map((label) => (
            <button
              key={label}
              disabled={busy}
              onClick={() =>
                run(
                  label === "Iniciar"
                    ? () => startServer(id)
                    : label === "Parar"
                      ? () => stopServer(id)
                      : () => restartServer(id),
                )
              }
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow disabled:opacity-50 ${
                label === "Iniciar"
                  ? "bg-way-600 text-white hover:bg-way-700"
                  : label === "Parar"
                    ? "bg-red-50 text-red-700 hover:bg-red-100"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Excluir "${server?.name}"?`)) {
                run(() => deleteServer(id)).then(onBack);
              }
            }}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            Excluir
          </button>
        </div>
      </div>

      {server && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p className="text-base font-bold text-slate-800">
            {server.name}{" "}
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-xs capitalize ${
                server.status === "running"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {server.status}
            </span>
          </p>
          <p className="mt-1 text-slate-500">
            {server.engine} {server.mcVersion} · {server.port} · {server.memoryMb} MB
          </p>
          <p className="text-xs text-slate-400">{server.installDir}</p>
          {server.status === "running" && (
            <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
              IP para jogar: <b>localhost:{server.port}</b>
            </p>
          )}
        </div>
      )}

      <div className="mb-3 flex gap-1">
        {(["console", "files"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
              tab === t ? "bg-way-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {!server && !error && <p className="text-slate-400">Carregando...</p>}

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {tab === "console" && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {players && server?.status === "running" && (
              <span className="rounded-full bg-emerald-900/60 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                {players} jogadores online
              </span>
            )}
            <span className="flex-1" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "errors")}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">Tudo</option>
              <option value="errors">Só erros/avisos</option>
            </select>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                autoScroll ? "bg-way-600 text-white" : "bg-slate-800 text-slate-400"
              }`}
            >
              Auto-scroll {autoScroll ? "on" : "off"}
            </button>
            <button
              onClick={copyLogs}
              className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Copiar
            </button>
            <button
              onClick={clearLogs}
              className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Limpar
            </button>
          </div>
          <pre
            ref={consoleRef}
            className={`h-80 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-5 ${
              filter === "errors" ? "text-red-300" : "text-slate-300"
            }`}
          >
            {filteredLogs.length === 0
              ? filter === "errors"
                ? "Nenhum erro registrado."
                : "Sem logs ainda. Inicie o servidor."
              : filteredLogs.join("\n")}
          </pre>
          <div className="mt-2 flex gap-2">
            <input
              ref={inputRef}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder='Comando (↑ para histórico) ex.: list, say oi, op jogador, stop'
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-way-500 focus:outline-none"
            />
            <button
              onClick={sendCmd}
              disabled={server?.status !== "running"}
              className="rounded-lg bg-way-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-way-700 disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      )}

      {tab === "files" && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
            <span>
              <button
                onClick={() => setFilesPath(".")}
                className="font-medium text-way-600 hover:underline"
              >
                /
              </button>{" "}
              / <b>{filesPath}</b>
            </span>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-lg bg-way-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-way-700">
                + Enviar arquivo
                <input type="file" className="hidden" multiple onChange={onUpload} />
              </label>
              <button
                onClick={onNewFile}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                + Novo arquivo
              </button>
              {filesPath !== "." && (
                <button
                  onClick={() =>
                    setFilesPath(filesPath.split(/[\\/]/).slice(0, -1).join("/") || ".")
                  }
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  ↑ Subir
                </button>
              )}
            </div>
          </div>
          <ul className="divide-y divide-slate-100">
            {files.map((f) => (
              <li key={f.path} className="flex items-center justify-between px-3 py-2 text-sm">
                <button
                  disabled={f.type !== "dir"}
                  onClick={() =>
                    f.type === "dir" ? setFilesPath(f.path) : openFile(f.path, f.size)
                  }
                  className={`flex-1 text-left ${
                    f.type === "dir"
                      ? "font-medium text-way-600 hover:underline"
                      : "text-slate-700 hover:text-way-700"
                  }`}
                >
                  {f.type === "dir" ? "📁" : "📄"} {f.name}
                  {f.type === "file" && (
                    <span className="ml-2 text-xs text-slate-400">{fmt(f.size)}</span>
                  )}
                </button>
                <button
                  onClick={() => removeFile(f.path, f.type)}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-700"
                  title="Excluir"
                >
                  Excluir
                </button>
              </li>
            ))}
            {files.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-slate-400">Pasta vazia</li>
            )}
          </ul>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setViewing(null)}>
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="truncate text-sm font-bold text-slate-800">
                {viewing.path} {viewing.truncated && <span className="text-xs font-normal text-amber-600">(truncado)</span>}
              </p>
              <button
                onClick={() => setViewing(null)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-5 text-slate-700">
              {viewing.content || "(arquivo vazio ou binário)"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}