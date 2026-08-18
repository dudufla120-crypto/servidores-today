import { useEffect, useState } from "react";
import { fetchCompatibility } from "../frontend/src/api";
import type { Engine } from "../api/types";

interface Props {
  engine: string;
  mcVersion: string | null;
}

export type CompatState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; downloadUrl?: string }
  | { status: "error"; reason: string };

/**
 * Verificação automática de compatibilidade: Minecraft + motor
 * (Paper/Spigot/Purpur/Fabric/Forge/NeoForge), via API do backend.
 */
export function useCompatibility({ engine, mcVersion }: Props): CompatState {
  const [state, setState] = useState<CompatState>({ status: "idle" });

  useEffect(() => {
    if (!mcVersion || !engine) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "checking" });
    const debounce = setTimeout(() => {
      fetchCompatibility(engine as Engine, mcVersion)
        .then((res) => {
          if (cancelled) return;
          if (res.compatible) {
            setState({ status: "ok", downloadUrl: res.downloadUrl });
          } else {
            setState({ status: "error", reason: res.reason ?? "Combinação incompatível." });
          }
        })
        .catch(() => {
          if (!cancelled) setState({ status: "error", reason: "Erro ao consultar a API." });
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [engine, mcVersion]);

  return state;
}

export function CompatibilityBadge({ state }: { state: CompatState }) {
  if (state.status === "idle") return null;
  if (state.status === "checking") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
        Verificando compatibilidade…
      </span>
    );
  }
  if (state.status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Compatível: {""}disponível para instalação
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      {state.reason}
    </span>
  );
}