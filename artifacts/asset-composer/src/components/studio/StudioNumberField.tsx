import { useEffect, useState } from "react";
export function NumberField({
  label,
  value,
  onChange,
  min,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  step?: number;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(Math.round(value * 1000) / 1000)), [value]);
  return (
    <label className="flex justify-between items-center gap-2 text-xs">
      {label}
      <input
        aria-label={label}
        type="number"
        min={min}
        step={step}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text);
          if (
            Number.isFinite(n) &&
            n !== value &&
            (min === undefined || n >= min)
          )
            onChange(n);
          else setText(String(value));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="bg-background border rounded px-1 w-20 h-6"
      />
    </label>
  );
}
