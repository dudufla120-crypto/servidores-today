import { useEffect, useState } from "react";
import { ServerForm, type ServerFormResult } from "../components/ServerForm";
import { Modal } from "../components/Modal";

export function CreateServerPage({ onBack }: { onBack: () => void }) {
  const [created, setCreated] = useState<ServerFormResult | null>(null);

  useEffect(() => {
    if (created) {
      const t = setTimeout(onBack, 3500);
      return () => clearTimeout(t);
    }
  }, [created, onBack]);

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-sm font-medium text-way-600 hover:underline"
      >
        &larr; Voltar
      </button>
      <h2 className="mb-1 text-xl font-bold text-slate-800">Criar servidor</h2>
      <p className="mb-6 text-sm text-slate-500">
        Escolha o motor (Paper, Spigot, Purpur, Fabric, Forge, NeoForge…) e a versão do
        Minecraft. O sistema verifica a compatibilidade automaticamente.
      </p>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <ServerForm onCreated={setCreated} />
      </div>

      <Modal open={created !== null} title="Servidor criado" onClose={onBack}>
        {created && (
          <div className="space-y-2 text-sm">
            <p className="text-emerald-700">
              Servidor <strong>{created.slug}</strong> criado com sucesso!
            </p>
            <p className="text-slate-500">
              Os arquivos ficam na VM em <code className="rounded bg-slate-100 px-1">{created.serverId}</code>.
              Inicie-o na aba "Meus servidores".
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}