import type { CadenceFilter as CadenceFilterValue } from "../canvas/adapters";

interface CadenceFilterProps {
  value: CadenceFilterValue;
  onChange(value: CadenceFilterValue): void;
}

const options: Array<{ id: CadenceFilterValue; label: string }> = [
  { id: "all", label: "All" },
  { id: "monthly", label: "Monthly" },
  { id: "annual", label: "Annual" },
  { id: "other", label: "Other" },
];

export function CadenceFilter({ value, onChange }: CadenceFilterProps) {
  return (
    <div className="cadence-filter" role="toolbar" aria-label="Filter relationships by cadence">
      <span>Cadence</span>
      {options.map((option) => (
        <button
          aria-pressed={value === option.id}
          key={option.id}
          onClick={() => onChange(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
