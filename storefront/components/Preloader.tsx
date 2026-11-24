"use client";

import { useEffect, useState } from "react";

interface Props {
  brand: string;
  logoUrl: string | null;
  label: string;
  /** real readiness 0..100 (garments loaded / total) */
  progress: number;
  ready: boolean;
  locale: string;
  onDone: () => void;
}

/** Minimal editorial preloader. The displayed number eases toward the *real* load progress, then lifts to reveal the scene. */
export function Preloader({ brand, logoUrl, label, progress, ready, locale, onDone }: Props) {
  const [shown, setShown] = useState(0);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setShown((s) => {
        const target = ready ? 100 : Math.min(92, progress);
        const next = s + Math.max((target - s) * dt * 4, target > s ? dt * 18 : 0); // always creeps forward so it never looks frozen
        return Math.min(next, target);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress, ready]);

  const done = ready && shown >= 99.5;
  useEffect(() => {
    if (!done) return;
    onDone();
    const t = setTimeout(() => setGone(true), 1600);
    return () => clearTimeout(t);
  }, [done, onDone]);

  if (gone) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center transition-[opacity,transform] duration-[1400ms] ease-out"
      style={{ background: "var(--sf-bg)", opacity: done ? 0 : 1, transform: done ? "scale(1.03)" : "none", pointerEvents: done ? "none" : "auto" }}
      role="status"
      aria-live="polite"
    >
      <div className="flex w-64 flex-col items-center gap-6 text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={brand} className="h-10 w-auto" />
        ) : (
          <div className="sf-display text-4xl">{brand}</div>
        )}
        <div className="h-px w-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--sf-fg) 18%, transparent)" }}>
          <div className="h-full origin-left rtl:origin-right" style={{ background: "var(--sf-accent)", transform: `scaleX(${shown / 100})` }} />
        </div>
        <div className="flex w-full items-baseline justify-between sf-label">
          <span>{label}</span>
          <span className="tabular-nums">{new Intl.NumberFormat(locale).format(Math.round(shown))}%</span>
        </div>
      </div>
    </div>
  );
}
