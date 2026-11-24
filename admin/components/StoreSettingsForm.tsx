"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { settingsInput, type SettingsInput } from "@/shared/schemas/admin";
import { api } from "../lib/api";
import { useAdmin } from "../lib/context";
import { AssetUploader } from "./AssetUploader";
import { Field, MoneyInput, Toggle } from "./ui";

export function StoreSettingsForm({ initial, presets }: { initial: SettingsInput; presets: { slug: string; name: string }[] }) {
  const router = useRouter();
  const { notify } = useAdmin();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SettingsInput>(k: K, v: SettingsInput[K]) => setS((x) => ({ ...x, [k]: v }));

  async function save() {
    const parsed = settingsInput.safeParse(s);
    if (!parsed.success) return notify(`${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`, "error");
    setBusy(true);
    try {
      await api("/api/admin/settings", { method: "PUT", body: parsed.data });
      notify("Store settings saved");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-6 p-6">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Brand name"><input className="input" value={s.brandName} onChange={(e) => set("brandName", e.target.value)} /></Field>
        <Field label="Tagline"><input className="input" value={s.tagline ?? ""} onChange={(e) => set("tagline", e.target.value || null)} /></Field>
        <AssetUploader kind="brand" accept="image/png,image/jpeg,image/webp,image/svg+xml" label="Logo" value={s.logoUrl} onChange={(k) => set("logoUrl", k)} preview />
        <AssetUploader kind="brand" accept="image/png,image/x-icon,image/svg+xml" label="Favicon" value={s.faviconUrl} onChange={(k) => set("faviconUrl", k)} preview />
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-line pt-6">
        <Field label="Language">
          <select className="input" value={s.defaultLocale} onChange={(e) => { const v = e.target.value as "en" | "fa"; setS((x) => ({ ...x, defaultLocale: v, direction: v === "fa" ? "rtl" : "ltr" })); }}>
            <option value="en">English</option>
            <option value="fa">Persian (fa)</option>
          </select>
        </Field>
        <Field label="Text direction">
          <select className="input" value={s.direction} onChange={(e) => set("direction", e.target.value as "ltr" | "rtl")}>
            <option value="ltr">LTR (left to right)</option>
            <option value="rtl">RTL (right to left)</option>
          </select>
        </Field>
        <Field label="Currency (ISO 4217)"><input className="input uppercase" value={s.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></Field>
        <Field label="Currency decimals" hint="Changing this does not convert existing prices; they are stored as integer minor units.">
          <input className="input" type="number" min={0} max={4} value={s.currencyDecimals} onChange={(e) => set("currencyDecimals", Math.min(4, Math.max(0, Math.round(Number(e.target.value)))))} />
        </Field>
        <Field label="Order number prefix" hint={`Orders look like ${s.orderNumberPrefix || "ORD"}-20260101-AB3XK`}>
          <input className="input font-mono uppercase" maxLength={8} value={s.orderNumberPrefix} onChange={(e) => set("orderNumberPrefix", e.target.value.toUpperCase())} />
        </Field>
        <Field label="Flat shipping rate"><MoneyInput value={s.flatShippingRate} onChange={(m) => set("flatShippingRate", m)} /></Field>
        <div>
          <Toggle checked={s.freeShippingThreshold !== null} onChange={(on) => set("freeShippingThreshold", on ? 20000 : null)} label="Free shipping threshold" />
          {s.freeShippingThreshold !== null && <div className="mt-2"><MoneyInput value={s.freeShippingThreshold} onChange={(m) => set("freeShippingThreshold", m)} /></div>}
        </div>
      </div>

      <div className="border-t border-line pt-6">
        <Field label="Studio theme preset" hint="The default lighting rig for the storefront and for racks without their own environment preset.">
          <select className="input" value={s.studioThemePreset} onChange={(e) => set("studioThemePreset", e.target.value)}>
            {presets.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="flex justify-end"><button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save store settings"}</button></div>
    </div>
  );
}
