"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAdmin } from "../lib/context";

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-mute">{hint}</span>}
    </label>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div>
        <h1 className="font-display text-4xl tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full border transition ${checked ? "border-gold bg-gold/80" : "border-line bg-ink"}`}
      >
        <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-bone transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
      {label}
    </label>
  );
}

/** Money input in major units; reports integer minor units (or null while the text is invalid). */
export function MoneyInput({ value, onChange, className = "" }: { value: number; onChange: (minor: number) => void; className?: string }) {
  const { toMajor, toMinor, currency } = useAdmin();
  const [text, setText] = useState(toMajor(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    // external change (e.g. loading a different record)
    if (toMinor(text) !== value) setText(toMajor(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <input
        className={`input pr-14 ${invalid ? "border-red-700" : ""} ${className}`}
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const m = toMinor(e.target.value);
          setInvalid(m === null);
          if (m !== null) onChange(m);
        }}
        onBlur={() => {
          const m = toMinor(text);
          if (m !== null) setText(toMajor(m));
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mute">{currency}</span>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: "border-amber-700/60 text-amber-300",
  paid: "border-sky-700/60 text-sky-300",
  processing: "border-indigo-600/60 text-indigo-300",
  shipped: "border-violet-600/60 text-violet-300",
  delivered: "border-emerald-700/60 text-emerald-300",
  cancelled: "border-red-800/60 text-red-300",
  refunded: "border-zinc-600 text-zinc-300",
};
export function StatusChip({ status }: { status: string }) {
  return <span className={`chip ${STATUS_STYLES[status] ?? ""}`}>{status}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card px-6 py-14 text-center text-sm text-mute">{children}</div>;
}
