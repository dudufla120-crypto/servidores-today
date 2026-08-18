import { useEffect, useState } from "react";
import { fetchPublicConfig, type PublicConfig } from "../api";

let cached: Promise<PublicConfig> | null = null;

export function useAdsConfig(): PublicConfig {
  const [cfg, setCfg] = useState<PublicConfig>({
    adsense: { enabled: false, client: "", slotBanner: "", slotSidebar: "" },
  });
  useEffect(() => {
    if (!cached) cached = fetchPublicConfig();
    cached.then(setCfg).catch(() => {});
  }, []);
  return cfg;
}

const pushedSlots = new Set<string>();

function pushAdSlot(slot: string) {
  if (pushedSlots.has(slot)) return;
  pushedSlots.add(slot);
  const w = window as unknown as { adsbygoogle?: unknown[] };
  try {
    (w.adsbygoogle = w.adsbygoogle || []).push({});
  } catch {
    /* ignore */
  }
}

function probeScript(client: string, done: (blocked: boolean) => void) {
  const probe = document.createElement("script");
  probe.async = true;
  probe.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
  probe.onerror = () => done(true);
  probe.onload = () => setTimeout(() => done(false), 500);
  document.head.appendChild(probe);
}

export function AdUnit({ slot, format, className }: { slot: string; format: string; className?: string }) {
  const cfg = useAdsConfig();
  useEffect(() => {
    if (cfg.adsense.enabled && slot) pushAdSlot(slot);
  }, [cfg.adsense.enabled, slot]);
  if (!cfg.adsense.enabled || !slot) return null;
  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={cfg.adsense.client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

export function AdBanner() {
  const cfg = useAdsConfig();
  if (!cfg.adsense.enabled || !cfg.adsense.slotBanner) return null;
  return <AdUnit slot={cfg.adsense.slotBanner} format="auto" className="mb-4 overflow-hidden rounded-xl bg-slate-50" />;
}

export function AdBlockSlot() {
  const cfg = useAdsConfig();
  if (!cfg.adsense.enabled || !cfg.adsense.slotSidebar) return null;
  return <AdUnit slot={cfg.adsense.slotSidebar} format="rectangle" className="mt-4 overflow-hidden rounded-xl bg-slate-50" />;
}

export function AdBlockGate() {
  const cfg = useAdsConfig();
  const [blocked, setBlocked] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!cfg.adsense.enabled || !cfg.adsense.client) return;
    setBlocked(false);
    const t = setTimeout(() => probeScript(cfg.adsense.client, setBlocked), 500);
    return () => clearTimeout(t);
  }, [cfg.adsense.enabled, cfg.adsense.client, retry]);

  if (!cfg.adsense.enabled || !blocked) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
            <circle cx="12" cy="12" r="9" />
            <path d="M5 5l14 14" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800">Desative o bloqueador de anúncios</h2>
        <p className="mt-3 text-sm text-slate-500">
          Os anúncios mantêm os servidores 100% gratuitos. Desative o bloqueador de anúncios nesta
          página e recarregue para continuar.
        </p>
        <button
          onClick={() => setRetry((r) => r + 1)}
          className="mt-6 rounded-lg bg-way-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-way-700"
        >
          Já desativei — verificar
        </button>
      </div>
    </div>
  );
}