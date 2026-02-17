import type { AgentMode } from "@mitchmyburgh/shared";

interface ModeSelectorProps {
  mode: AgentMode;
  onChange: (mode: AgentMode) => void;
  disabled?: boolean;
}

const MODE_OPTIONS: { value: AgentMode; label: string; color: string }[] = [
  { value: "plan", label: "Plan", color: "bg-amber-500" },
  { value: "human_confirm", label: "Confirm", color: "bg-orange-500" },
  { value: "accept_all", label: "Auto", color: "bg-emerald-500" },
];

export function ModeSelector({ mode, onChange, disabled }: ModeSelectorProps) {
  return (
    <select
      value={mode}
      onChange={(e) => onChange(e.target.value as AgentMode)}
      disabled={disabled}
      className={`rounded px-2 py-0.5 text-[11px] font-medium text-white outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
        MODE_OPTIONS.find((o) => o.value === mode)?.color ?? "bg-gray-600"
      }`}
      title="Agent mode"
    >
      {MODE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
