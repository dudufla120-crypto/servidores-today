import { useEffect, useState } from "react";
import {
  deleteServer,
  listServers,
  restartServer,
  startServer,
  stopServer,
} from "../frontend/src/api";

export function DashboardPage({ onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void }) {
  const [servers, setServers] = useState<{
    id: string;
    name: string;
    engine: string;
    mcVersion: string;
    status: string;
    port: number;
    memoryMb: number;
  }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    listServers()
      .then((res) => setServers(res.servers as never[]))
      .catch((err: Error) => setError(err.message));

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const run = async (id: string, fn: (id: string) => Promise<unknown>) => {
    setBusy(id);
    setError(null);
    try {
      await fn(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const statusColor = (s: string) =>
    s === "running"
      ? "bg-emerald-100 text-emerald-700"
      : s === "installing"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-600";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Meus servidores</h2>
        <button
          onClick={onNew}
          className="rounded-lg bg-way-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-way-700"
        >
          + Novo servidor
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {servers.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">Nenhum servidor criado ainda.</p>
          <p className="mt-1 text-sm text-slate-400">
            Clique em "Novo servidor" para criar o primeiro com o motor e a versão de sua escolha.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {servers.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex-1 cursor-pointer" onClick={() => onOpen(s.id)}>
              <p className="font-semibold text-slate-800">{s.name}</p>
              <p className="text-sm text-slate-500">
                {s.engine} {s.mcVersion} · porta {s.port} · {s.memoryMb} MB
              </p>
            </div>
            <div className="flex items-center gap-2">
              {s.status === "running" ? (
                <>
                  <button
                    onClick={() => run(s.id, stopServer)}
                    disabled={busy === s.id}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    {busy === s.id ? "..." : "Parar"}
                  </button>
                  <button
                    onClick={() => run(s.id, restartServer)}
                    disabled={busy === s.id}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                  >
                    Reiniciar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => run(s.id, startServer)}
                  disabled={busy === s.id || s.status === "installing"}
                  className="rounded-lg bg-way-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-way-700 disabled:opacity-50"
                >
                  {busy === s.id ? "..." : s.status === "installing" ? "Instalando..." : "Iniciar"}
                </button>
              )}
              <button
                onClick={() => {
                  if (window.confirm(`Excluir "${s.name}"? Os arquivos serão removidos.`)) {
                    run(s.id, deleteServer);
                  }
                }}
                disabled={busy === s.id}
                className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                title="Excluir servidor"
              >
                Excluir
              </button>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusColor(s.status)}`}
              >
                {s.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}