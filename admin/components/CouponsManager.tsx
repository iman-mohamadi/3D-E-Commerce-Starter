"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { couponInput } from "@/shared/schemas/admin";
import { api } from "../lib/api";
import { useAdmin } from "../lib/context";
import { Empty, Field, MoneyInput, Toggle } from "./ui";

interface Coupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  maxUses: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}
type Form = Omit<Coupon, "id" | "usedCount"> & { id?: string };

const blank: Form = { code: "", type: "percent", value: 10, minSubtotal: 0, maxUses: null, startsAt: null, expiresAt: null, isActive: true };
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function CouponsManager({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const { money, notify } = useAdmin();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form) return;
    const parsed = couponInput.safeParse(form);
    if (!parsed.success) return notify(`${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`, "error");
    setBusy(true);
    try {
      if (form.id) await api(`/api/admin/coupons/${form.id}`, { method: "PATCH", body: form });
      else await api("/api/admin/coupons", { body: form });
      notify("Coupon saved");
      setForm(null);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Coupon) {
    if (!confirm(`Delete coupon ${c.code}? Past orders keep the code they used.`)) return;
    try {
      await api(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  const describe = (c: Coupon) => (c.type === "percent" ? `${c.value}% off` : `${money(c.value)} off`);

  return (
    <>
      <div className="mb-4 flex justify-end"><button className="btn btn-primary" onClick={() => setForm({ ...blank })}>New coupon</button></div>

      {coupons.length === 0 ? (
        <Empty>No coupons yet.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line"><tr><th className="th">Code</th><th className="th">Discount</th><th className="th">Min. subtotal</th><th className="th">Used</th><th className="th">Valid</th><th className="th">Status</th><th /></tr></thead>
            <tbody className="divide-y divide-line">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-raised/40">
                  <td className="td font-mono text-xs">{c.code}</td>
                  <td className="td">{describe(c)}</td>
                  <td className="td">{c.minSubtotal ? money(c.minSubtotal) : "-"}</td>
                  <td className="td">{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}</td>
                  <td className="td text-mute">{c.startsAt || c.expiresAt ? `${day(c.startsAt) || "now"} to ${day(c.expiresAt) || "open"}` : "always"}</td>
                  <td className="td"><span className={`chip ${c.isActive ? "border-emerald-700/60 text-emerald-300" : ""}`}>{c.isActive ? "active" : "off"}</span></td>
                  <td className="td text-right">
                    <button className="btn mr-2 px-3 py-1" onClick={() => setForm({ ...c })}>Edit</button>
                    <button className="btn btn-danger px-3 py-1" onClick={() => remove(c)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onClick={() => setForm(null)}>
          <div className="card w-full max-w-lg space-y-4 p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Coupon">
            <h2 className="font-display text-3xl">{form.id ? "Edit coupon" : "New coupon"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Code"><input className="input font-mono uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field>
              <Field label="Type">
                <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Form["type"], value: e.target.value === "percent" ? 10 : 0 })}>
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </Field>
              <Field label={form.type === "percent" ? "Percent off (1-100)" : "Amount off"}>
                {form.type === "percent" ? <input className="input" type="number" min={1} max={100} value={form.value} onChange={(e) => setForm({ ...form, value: Math.round(Number(e.target.value)) })} /> : <MoneyInput value={form.value} onChange={(v) => setForm({ ...form, value: v })} />}
              </Field>
              <Field label="Minimum subtotal"><MoneyInput value={form.minSubtotal} onChange={(v) => setForm({ ...form, minSubtotal: v })} /></Field>
              <Field label="Max uses (blank = unlimited)"><input className="input" type="number" min={1} value={form.maxUses ?? ""} onChange={(e) => setForm({ ...form, maxUses: e.target.value ? Math.round(Number(e.target.value)) : null })} /></Field>
              <span />
              <Field label="Starts"><input className="input" type="date" value={day(form.startsAt)} onChange={(e) => setForm({ ...form, startsAt: e.target.value || null })} /></Field>
              <Field label="Expires"><input className="input" type="date" value={day(form.expiresAt)} onChange={(e) => setForm({ ...form, expiresAt: e.target.value || null })} /></Field>
            </div>
            <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Active" />
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <button className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save coupon"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
