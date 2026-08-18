import { useState } from "react";
import { DashboardPage } from "../../pages/DashboardPage";
import { CreateServerPage } from "../../pages/CreateServerPage";
import { ServerPage } from "../../pages/ServerPage";

export default function App() {
  const [view, setView] = useState<"dashboard" | "create" | "server">("dashboard");
  const [serverId, setServerId] = useState<string | null>(null);

  const openServer = (id: string) => {
    setServerId(id);
    setView("server");
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-way-700">Way Servidores</h1>
          <nav className="flex gap-1">
            <button
              onClick={() => setView("dashboard")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                view === "dashboard"
                  ? "bg-way-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Meus servidores
            </button>
            <button
              onClick={() => setView("create")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                view === "create"
                  ? "bg-way-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Novo servidor
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {view === "dashboard" && <DashboardPage onNew={() => setView("create")} onOpen={openServer} />}
        {view === "create" && <CreateServerPage onBack={() => setView("dashboard")} />}
        {view === "server" && serverId && (
          <ServerPage id={serverId} onBack={() => setView("dashboard")} />
        )}
      </main>
    </div>
  );
}