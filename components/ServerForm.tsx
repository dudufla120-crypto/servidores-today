import { useEffect, useState } from "react";
import { createServer, fetchEngines } from "../frontend/src/api";
import type { ServerConfig } from "../api/types";
import type { EngineOption } from "./EngineSelector";
import { EngineSelector } from "./EngineSelector";
import { CompatibilityBadge, useCompatibility } from "./Compatibility";
import { VersionPicker } from "./VersionPicker";

export interface ServerFormResult {
  serverId: string;
  slug: string;
}

interface Props {
  onCreated: (result: ServerFormResult) => void;
}

/**
 * Formulário de criação de servidor:
 * nome -> motor -> versão do Minecraft (com verificação de compatibilidade)
 * -> memória / porta -> criar.
 */
export function ServerForm({ onCreated }: Props) {
  const [engines, setEngines] = useState<EngineOption[]>([]);
  const [name, setName] = useState("");
  const [engine, setEngine] = useState("paper");
  const [version, setVersion] = useState<string | null>(null);
  const [memoryMb, setMemoryMb] = useState(2048);
  const [port, setPort] = useState(25565);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetchEngines()
      .then((res) => {
        if (!active) return;
        setEngines(res.engines as EngineOption[]);
        if (res.engines[0]) setEngine(res.engines[0].id);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const compat = useCompatibility({ engine, mcVersion: version });
  const canSubmit = Boolean(name && version) && compat.status === "ok" && !submitting;

  const submit = async () => {
    if (!version) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: ServerConfig = {
        name,
        engine: engine as ServerConfig["engine"],
        mcVersion: version,
        memoryMb,
        port,
        maxPlayers: 20,
      };
      const res = await createServer(payload);
      onCreated(res as ServerFormResult);
    } catch (err) {
      setSubmitError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Nome do servidor</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Meu Survival"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-way-500 focus:outline-none focus:ring-2 focus:ring-way-500/30"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Motor</label>
        <EngineSelector engines={engines} value={engine} onChange={setEngine} />
      </div>

      <VersionPicker engine={engine} value={version} onChange={setVersion} />

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-600">Compatibilidade:</label>
        <CompatibilityBadge state={compat} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Memória (MB)
          </label>
          <input
            type="number"
            min={1024}
            step={512}
            value={memoryMb}
            onChange={(e) => setMemoryMb(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-way-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Porta</label>
          <input
            type="number"
            min={25565}
            max={25665}
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-way-500 focus:outline-none"
          />
        </div>
      </div>

      {submitError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void submit()}
        className="w-full rounded-lg bg-way-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-way-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? "Criando servidor…" : "Criar servidor"}
      </button>

      <p className="text-[11px] text-slate-400">
        O sistema verifica automaticamente a combinação Minecraft + versão + motor antes de
        criar o servidor, evitando instalações incompatíveis.
      </p>
    </div>
  );
}