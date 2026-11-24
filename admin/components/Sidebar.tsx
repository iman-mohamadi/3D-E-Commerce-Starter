"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/racks", label: "Racks" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/settings", label: "Studio Settings" },
];

export function Sidebar({ brand, email }: { brand: string; email: string }) {
  const path = usePathname();
  const router = useRouter();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-panel">
      <div className="border-b border-line px-6 py-6">
        <div className="font-display text-2xl leading-none">{brand}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-gold">Admin atelier</div>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {NAV.map((n) => {
          const active = n.exact ? path === n.href : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`block rounded-sm px-3 py-2.5 text-sm transition ${active ? "bg-raised text-bone" : "text-mute hover:bg-raised/60 hover:text-bone"}`}
              aria-current={active ? "page" : undefined}
            >
              {active && <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-gold align-middle" />}
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line p-4 text-xs text-mute">
        <div className="truncate">{email}</div>
        <button
          className="mt-2 text-bone underline-offset-4 hover:underline"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.replace("/admin/login");
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
