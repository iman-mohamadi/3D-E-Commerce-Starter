"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Sign-in failed");
      return setBusy(false);
    }
    if (data.user?.role !== "admin") {
      await fetch("/api/auth/logout", { method: "POST" }); // customers must not keep a session from this form
      setError("This account does not have admin access");
      return setBusy(false);
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/admin") ? next : "/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-sm space-y-5 p-8">
      <div>
        <div className="text-[10px] uppercase tracking-[0.28em] text-gold">Admin atelier</div>
        <h1 className="mt-2 font-display text-4xl">Sign in</h1>
      </div>
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required autoComplete="username" className="input" autoFocus />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </label>
      {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Signing in..." : "Enter the atelier"}
      </button>
    </form>
  );
}

export default function AdminLogin() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,#1a1a22,#0b0b0d_60%)] p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
