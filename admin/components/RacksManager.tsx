"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAdmin } from "../lib/context";
import { Field, Toggle } from "./ui";

interface Rack {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isDefault: boolean;
  environmentPreset: string | null;
}
interface RackProduct {
  id: string;
  title: string;
  collectionId: string | null;
  rackPosition: number;
  isActive: boolean;
  kind: string;
}

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const blank = (sortOrder: number): Omit<Rack, "id"> => ({ title: "", slug: "", description: null, sortOrder, isDefault: false, environmentPreset: null });

export function RacksManager({ racks, products, presets }: { racks: Rack[]; products: RackProduct[]; presets: { slug: string; name: string }[] }) {
  const router = useRouter();
  const { notify } = useAdmin();
  const [selectedId, setSelectedId] = useState<string | "new" | null>(racks.find((r) => r.isDefault)?.id ?? racks[0]?.id ?? null);
  const selected = racks.find((r) => r.id === selectedId) ?? null;
  const [form, setForm] = useState<Omit<Rack, "id">>(selected ?? blank(racks.length));
  const [slugTouched, setSlugTouched] = useState(true);
  const [order, setOrder] = useState<RackProduct[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (selectedId === "new") {
      setForm(blank(racks.length));
      setSlugTouched(false);
      setOrder([]);
    } else if (selected) {
      const { id: _id, ...rest } = selected;
      setForm(rest);
      setSlugTouched(true);
      setOrder(products.filter((p) => p.collectionId === selected.id).sort((a, b) => a.rackPosition - b.rackPosition));
    }
  }, [selectedId, selected, products, racks.length]);

  async function save() {
    setBusy(true);
    try {
      if (selectedId === "new") {
        const { collection } = await api<{ collection: Rack }>("/api/admin/collections", { body: form });
        setSelectedId(collection.id);
        notify("Rack created");
      } else if (selected) {
        await api(`/api/admin/collections/${selected.id}`, { method: "PATCH", body: form });
        notify("Rack saved");
      }
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected || !confirm(`Delete rack "${selected.title}"? Its products are kept but become unassigned.`)) return;
    try {
      await api(`/api/admin/collections/${selected.id}`, { method: "DELETE" });
      setSelectedId(racks.find((r) => r.id !== selected.id)?.id ?? null);
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function drop(targetId: string) {
    if (!selected || !dragId || dragId === targetId) return;
    const from = order.findIndex((p) => p.id === dragId);
    const to = order.findIndex((p) => p.id === targetId);
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    setOrder(next);
    setDragId(null);
    try {
      await api(`/api/admin/collections/${selected.id}/reorder`, { method: "PUT", body: { productIds: next.map((p) => p.id) } });
      notify("Rack order saved");
      router.refresh();
    } catch (e) {
      notify((e as Error).message, "error");
      router.refresh();
    }
  }

  const unassigned = products.filter((p) => !p.collectionId);

  return (
    <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-8">
      <aside>
        <ul className="space-y-1">
          {racks.map((r) => (
            <li key={r.id}>
              <button onClick={() => setSelectedId(r.id)} className={`flex w-full items-center justify-between rounded-sm border px-3 py-2.5 text-left text-sm transition ${selectedId === r.id ? "border-gold bg-raised" : "border-line bg-panel hover:border-gold/50"}`}>
                <span>{r.title}</span>
                {r.isDefault && <span className="chip border-gold/60 text-gold">default</span>}
              </button>
            </li>
          ))}
        </ul>
        <button className="btn mt-3 w-full" onClick={() => setSelectedId("new")}>New rack</button>
      </aside>

      <section className="min-w-0 space-y-8">
        {selectedId === null ? (
          <p className="card px-6 py-12 text-center text-sm text-mute">Create your first rack.</p>
        ) : (
          <>
            <div className="card space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Title"><input className="input" value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value, slug: slugTouched ? form.slug : slugify(e.target.value) }); }} /></Field>
                <Field label="Slug"><input className="input font-mono text-xs" value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }); }} /></Field>
              </div>
              <Field label="Description"><textarea className="input" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value || null })} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Environment preset">
                  <select className="input" value={form.environmentPreset ?? ""} onChange={(e) => setForm({ ...form, environmentPreset: e.target.value || null })}>
                    <option value="">Store default theme</option>
                    {presets.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Sort order"><input className="input" type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Math.max(0, Math.round(Number(e.target.value))) })} /></Field>
              </div>
              <Toggle checked={form.isDefault} onChange={(v) => setForm({ ...form, isDefault: v })} label="Default rack (opens first in the storefront; unsets the previous default)" />
              <div className="flex justify-between border-t border-line pt-4">
                {selected ? <button className="btn btn-danger" onClick={remove}>Delete rack</button> : <span />}
                <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving..." : selectedId === "new" ? "Create rack" : "Save rack"}</button>
              </div>
            </div>

            {selected && (
              <div>
                <h2 className="font-display text-2xl">Rack order</h2>
                <p className="mb-3 text-sm text-mute">Drag garments to reorder them along the rail (left to right).</p>
                {order.length === 0 ? (
                  <p className="card px-6 py-10 text-center text-sm text-mute">No products on this rack. Assign one from its product page.</p>
                ) : (
                  <ol className="flex flex-wrap gap-3">
                    {order.map((p, i) => (
                      <li
                        key={p.id}
                        draggable
                        onDragStart={() => setDragId(p.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => drop(p.id)}
                        onDragEnd={() => setDragId(null)}
                        className={`card w-40 cursor-grab select-none p-3 transition ${dragId === p.id ? "opacity-40" : "hover:border-gold/60"}`}
                      >
                        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-mute"><span>#{i + 1}</span><span>{p.kind}</span></div>
                        <div className="grid h-16 place-items-center rounded-sm bg-ink text-xs text-mute">hanger</div>
                        <Link href={`/admin/products/${p.id}`} draggable={false} className="mt-2 block truncate text-sm hover:text-gold">{p.title}</Link>
                        {!p.isActive && <span className="chip mt-1">draft</span>}
                      </li>
                    ))}
                  </ol>
                )}
                {unassigned.length > 0 && <p className="mt-4 text-xs text-mute">{unassigned.length} unassigned product(s): {unassigned.map((p) => p.title).join(", ")}.</p>}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
