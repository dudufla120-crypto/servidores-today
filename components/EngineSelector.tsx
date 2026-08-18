export interface EngineOption {
  id: string;
  label: string;
  description: string;
}

interface Props {
  engines: EngineOption[];
  value: string;
  onChange: (engine: string) => void;
}

export function EngineSelector({ engines, value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {engines.map((eng) => (
        <label
          key={eng.id}
          className={`cursor-pointer rounded-lg border p-3 transition ${
            value === eng.id
              ? "border-way-600 bg-way-50 shadow-sm"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <input
            type="radio"
            name="engine"
            className="sr-only"
            checked={value === eng.id}
            onChange={() => onChange(eng.id)}
          />
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                value === eng.id ? "bg-way-600" : "bg-slate-300"
              }`}
            />
            <span className="font-semibold text-slate-800">{eng.label}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{eng.description}</p>
        </label>
      ))}
    </div>
  );
}