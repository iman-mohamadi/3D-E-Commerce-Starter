"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "../lib/store-context";

function Inner({ mode }: { mode: "login" | "register" }) {
  const { t } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account/orders";
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const body = mode === "login" ? { email: f.get("email"), password: f.get("password") } : { email: f.get("email"), password: f.get("password"), name: (f.get("name") as string) || undefined };
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const field = data?.details?.fieldErrors ? Object.values(data.details.fieldErrors as Record<string, string[]>)[0]?.[0] : null;
        return setError(field ?? data.error ?? "Something went wrong");
      }
      router.replace(safeNext);
      router.refresh(); // re-read the customer in the layout
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-5 px-5 py-20">
      <h1 className="sf-display text-5xl">{mode === "login" ? t.login : t.register}</h1>
      {mode === "register" && <label className="block"><span className="sf-label mb-1.5 block">{t.name}</span><input name="name" className="sf-input" autoComplete="name" /></label>}
      <label className="block"><span className="sf-label mb-1.5 block">{t.email}</span><input name="email" type="email" required className="sf-input sf-ltr" autoComplete="email" /></label>
      <label className="block">
        <span className="sf-label mb-1.5 block">{t.password}</span>
        <input name="password" type="password" required minLength={mode === "register" ? 10 : 1} className="sf-input sf-ltr" autoComplete={mode === "login" ? "current-password" : "new-password"} />
        {mode === "register" && <span className="sf-muted mt-1 block text-xs">{t.passwordHint}</span>}
      </label>
      {error && <p className="text-sm" style={{ color: "#e48a7a" }} role="alert">{error}</p>}
      <button className="sf-btn sf-btn-primary w-full" disabled={busy}>{busy ? t.processing : mode === "login" ? t.login : t.register}</button>
      <p className="sf-muted text-sm">
        {mode === "login" ? t.noAccount : t.hasAccount}{" "}
        <Link className="underline underline-offset-4" href={`${mode === "login" ? "/register" : "/login"}${nextQuery}`}>{mode === "login" ? t.register : t.login}</Link>
      </p>
    </form>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  return (
    <Suspense>
      <Inner mode={mode} />
    </Suspense>
  );
}

export function SignOutButton() {
  const { t } = useStore();
  const router = useRouter();
  return (
    <button
      className="sf-btn"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/");
        router.refresh();
      }}
    >
      {t.signOut}
    </button>
  );
}
