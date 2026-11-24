import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminProvider } from "@/admin/lib/context";
import { Sidebar } from "@/admin/components/Sidebar";
import { currentUser } from "@/server/auth/guards";
import { storage } from "@/server/adapters/storage";
import { getSettings } from "@/server/services/admin";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");
  const s = await getSettings();
  const assetBase = storage().publicUrl("a").slice(0, -1);

  return (
    <AdminProvider
      currency={s?.currency ?? "USD"}
      decimals={s?.currencyDecimals ?? 2}
      locale={s?.defaultLocale === "fa" ? "fa-IR" : "en-US"}
      assetBase={assetBase}
    >
      <div className="flex min-h-screen">
        <Sidebar brand={s?.brandName ?? "Store"} email={user.email} />
        <main className="min-w-0 flex-1 px-10 py-8">{children}</main>
      </div>
    </AdminProvider>
  );
}
