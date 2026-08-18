import { useEffect, useMemo, useRef, useState } from "react";
import { fetchEngineVersions } from "../frontend/src/api";
import type { Engine } from "../api/types";
import { Modal } from "./Modal";

export interface VersionItem {
  id: string;
  stable: boolean;
}

interface Props {
  engine: string;
  value: string | null;
  onChange: (version: string) => void;
}

/**
 * Seletor de versão do Minecraft usado na criação de servidor.
 *
 * - Botão [ Escolher versão ] abre o modal com duas opções:
 *   o "Versão específica" -> versões estáveis (release) disponíveis.
 *   o "Todas as versões"  -> a biblioteca completa compatível com o motor.
 * - A lista vem da API do sistema (backend), que é atualizada
 *   automaticamente pelo worker a partir das APIs oficiais
 *   (Mojang, PaperMC, Purpur, Fabric, Forge, NeoForge).
 * - Só são exibidas versões compatíveis com o motor já selecionado.
 */
export function VersionPicker({ engine, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [allVersions, setAllVersions] = useState(false);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const fetchedRef = useRef<string>("");

  useEffect(() => {
    if (!open || !engine) return;
    setLoading(true);
    setError(null);
    fetchedRef.current = engine;
    fetchEngineVersions(engine as Engine, allVersions)
      .then((res) => setVersions(res.versions))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, engine, allVersions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return versions;
    return versions.filter((v) => v.id.toLowerCase().includes(q));
  }, [versions, search]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setSearch("");
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        Versão do Minecraft
      </label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:border-way-500 hover:shadow focus:outline-none focus:ring-2 focus:ring-way-500/40"
      >
        {value ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {value}
          </span>
        ) : (
          <span className="text-slate-500">Escolher versão</span>
        )}
        <span className="float-right text-slate-400">&#9662;</span>
      </button>

      <Modal open={open} title="Versão do Minecraft" onClose={() => setOpen(false)}>
        <div className="space-y-1">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
              !allVersions ? "border-way-600 bg-way-50" : "border-slate-200"
            }`}
          >
            <input
              type="radio"
              name="version-mode"
              checked={!allVersions}
              onChange={() => setAllVersions(false)}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-slate-800">Versão específica</span>
              <span className="block text-xs text-slate-500">
                Mostra as versões estáveis (release) disponíveis para o motor selecionado.
              </span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
              allVersions ? "border-way-600 bg-way-50" : "border-slate-200"
            }`}
          >
            <input
              type="radio"
              name="version-mode"
              checked={allVersions}
              onChange={() => setAllVersions(true)}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-slate-800">Todas as versões</span>
              <span className="block text-xs text-slate-500">
                Acesso à biblioteca completa de versões compatíveis com o motor (inclui
                snapshots e versões antigas). Apenas uma versão é instalada por servidor.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-4">
          <input
            type="text"
            placeholder="Buscar versão… (ex.: 1.21.8)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-way-500 focus:outline-none focus:ring-2 focus:ring-way-500/30"
          />
        </div>

        <div className="mt-3">
          {loading && (
            <p className="py-6 text-center text-sm text-slate-500">
              Carregando versões compatíveis com {engine}…
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          {!loading && !error && versions.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">
              Nenhuma versão disponível para o motor {engine}.
            </p>
          )}
          {!loading && !error && (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {filtered.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => pick(v.id)}
                    className={`w-full px-3 py-2 text-left text-sm transition hover:bg-way-50 ${
                      value === v.id ? "bg-way-50 font-semibold text-way-700" : "text-slate-700"
                    }`}
                  >
                    {v.id}
                    {!v.stable && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        snapshot
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-slate-400">
                  Nenhuma versão encontrada para "{search}"
                </li>
              )}
            </ul>
          )}
        </div>

        <p className="mt-3 text-[11px] text-slate-400">
          Lista atualizada automaticamente por APIs oficiais: Mojang, PaperMC, Purpur,
          Fabric, Forge e NeoForge.
        </p>
      </Modal>
    </div>
  );
}