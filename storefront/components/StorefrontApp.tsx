"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/shared/money";
import type { StorefrontData } from "@/shared/storefront";
import type { RackItem, ViewPreset } from "@/three";
import { cart } from "../lib/cart";
import { dict } from "../lib/i18n";
import { FallbackGrid } from "./FallbackGrid";
import { BottomHud, TopHud } from "./Hud";
import { Inspector, SizeGuideModal, colorwaysOf } from "./Inspector";
import { Preloader } from "./Preloader";
import { Scene, type SceneController } from "./Scene";

export function StorefrontApp({ data, initialRack }: { data: StorefrontData; initialRack?: string }) {
  const { settings, racks } = data;
  const locale = settings.defaultLocale;
  const rtl = settings.direction === "rtl";
  const t = dict(locale);
  const intl = locale === "fa" ? "fa-IR" : "en-US";
  const money = useCallback((m: number) => formatMoney(m, { currency: settings.currency, decimals: settings.currencyDecimals, locale: intl }), [settings.currency, settings.currencyDecimals, intl]);
  const fmtNum = useCallback((n: number) => new Intl.NumberFormat(intl).format(n), [intl]);

  const [rackSlug, setRackSlug] = useState(() => racks.find((r) => r.slug === initialRack)?.slug ?? racks.find((r) => r.isDefault)?.slug ?? racks[0]?.slug ?? "");
  const rack = racks.find((r) => r.slug === rackSlug) ?? racks[0];
  const products = useMemo(() => rack?.products ?? [], [rack]);

  const [webgl, setWebgl] = useState<"pending" | "ok" | "none">("pending");
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const controller = useRef<SceneController | null>(null);

  const [focusIndex, setFocusIndex] = useState(0);
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);

  const [inspectId, setInspectId] = useState<string | null>(null);
  const [colorName, setColorName] = useState("");
  const [size, setSize] = useState<string | null>(null);
  const [view, setView] = useState<ViewPreset>("front");
  const [viewNonce, setViewNonce] = useState(0);
  const [hotspotId, setHotspotId] = useState<string | null>(null);
  const [hotspotNonce, setHotspotNonce] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [inset, setInset] = useState({ x: 0, y: 0 });

  const inspectIndex = inspectId ? products.findIndex((p) => p.id === inspectId) : -1;
  const product = inspectIndex >= 0 ? products[inspectIndex]! : null;

  // rack items for the 3D stage (default look = first colourway)
  const items: RackItem[] = useMemo(
    () =>
      products.map((p) => {
        const v = p.variants[0];
        return {
          id: p.id,
          glbUrl: p.glbUrl,
          procedural: p.procedural,
          transform: p.transform,
          look: v ? { colorHex: v.colorHex, pbr: v.pbr } : { colorHex: "#8a8a8f", pbr: { roughness: 0.85, metalness: 0, meshTarget: "body" } },
          hotspots: p.hotspots.map((h) => ({ id: h.id, position: h.position, cameraOffset: h.cameraOffset })),
        };
      }),
    [products],
  );

  // panel-aware framing: keep the garment clear of the inspector (side panel or bottom sheet)
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      if (w >= 768) setInset({ x: (rtl ? 1 : -1) * Math.min(0.2, 200 / w), y: 0 });
      else setInset({ x: 0, y: 0.22 });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [rtl]);

  // --- actions
  const openProduct = useCallback(
    (id: string) => {
      const p = products.find((x) => x.id === id);
      if (!p) return;
      const colors = colorwaysOf(p.variants);
      setColorName((colors.find((c) => c.anyInStock) ?? colors[0])?.name ?? "");
      setSize(null);
      setView("front");
      setHotspotId(null);
      setAdded(false);
      setInspectId(id);
    },
    [products],
  );

  const closeInspect = useCallback(() => {
    setInspectId(null);
    setHotspotId(null);
    setGuideOpen(false);
  }, []);

  const switchRack = useCallback(
    (slug: string) => {
      if (slug === rackSlug) return;
      setHover(null);
      setFocusIndex(0);
      setRackSlug(slug);
    },
    [rackSlug],
  );

  const pickColor = (name: string) => {
    setColorName(name);
    const p = product;
    if (!p) return;
    const stillOk = size && p.variants.some((v) => v.colorName === name && v.size === size && v.inStock);
    if (!stillOk) setSize(null);
  };

  const pickView = (v: ViewPreset) => {
    setView(v);
    setViewNonce((n) => n + 1);
  };

  const pickHotspot = useCallback((id: string | null) => {
    setHotspotId(id);
    if (id) setHotspotNonce((n) => n + 1);
    else {
      setView("front");
      setViewNonce((n) => n + 1);
    }
  }, []);

  const colorVariant = product?.variants.find((v) => v.colorName === colorName) ?? null;
  const look = product && colorVariant && inspectIndex >= 0 ? { index: inspectIndex, colorHex: colorVariant.colorHex, pbr: colorVariant.pbr } : null;

  const addToBag = () => {
    if (!product) return;
    const v = product.variants.find((x) => x.colorName === colorName && x.size === size);
    if (!v || !v.inStock) return;
    cart.add({
      variantId: v.id,
      productId: product.id,
      productSlug: product.slug,
      title: product.title,
      sku: v.sku,
      colorName: v.colorName,
      colorHex: v.colorHex,
      size: v.size,
      unitPrice: product.basePrice + v.priceDelta,
      image: product.fallbackImageUrl,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  // keyboard: arrows browse the rack (visual direction), Escape steps back
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (guideOpen) setGuideOpen(false);
        else if (inspectId) closeInspect();
        return;
      }
      if (inspectId || guideOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") controller.current?.stepVisual(1);
      if (e.key === "ArrowLeft") controller.current?.stepVisual(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspectId, guideOpen, closeInspect]);

  // reset load state on rack change so the progress reflects the new rack (preloader only shows on first load)
  const onProgress = useCallback((l: number, total: number) => setProgress(total ? (l / total) * 100 : 100), []);
  const onLoaded = useCallback(() => setLoaded(true), []);
  const onUnsupported = useCallback(() => {
    setWebgl("none");
    setLoaded(true);
  }, []);
  const onRevealed = useCallback(() => setRevealed(true), []);
  useEffect(() => {
    if (webgl === "pending" && loaded) setWebgl("ok");
  }, [webgl, loaded]);

  const events = useMemo(
    () => ({
      onHover: setHover,
      onSelect: (i: number) => {
        const p = products[i];
        if (p) openProduct(p.id);
      },
      onHotspot: (id: string) => pickHotspot(id),
      onFocusIndex: setFocusIndex,
    }),
    [products, openProduct, pickHotspot],
  );

  if (!rack) return <main className="sf-root grid place-items-center p-8"><p className="sf-muted">{t.noProducts}</p></main>;

  const inspecting = !!product;
  const hoverProduct = hover && !inspecting ? products[hover.index] : null;
  const currentProduct = products[Math.min(focusIndex, Math.max(0, products.length - 1))];

  return (
    <main className="sf-root relative h-screen w-screen" data-webgl={webgl}>
      {webgl !== "none" && (
        <Scene
          rackKey={rack.slug}
          preset={rack.preset?.config ?? null}
          lightingOverride={settings.lightingOverride}
          items={items}
          rtl={rtl}
          revealed={revealed}
          inspectIndex={inspectIndex >= 0 ? inspectIndex : null}
          inset={inset}
          view={view}
          viewNonce={viewNonce}
          look={look}
          selectedHotspot={hotspotId}
          hotspotNonce={hotspotNonce}
          controller={controller}
          onProgress={onProgress}
          onLoaded={onLoaded}
          onUnsupported={onUnsupported}
          events={events}
        />
      )}

      {webgl === "none" && <FallbackGrid t={t} products={products} money={money} onOpen={openProduct} />}

      <TopHud racks={racks.map((r) => ({ slug: r.slug, title: r.title }))} activeRack={rack.slug} onRack={switchRack} dimmed={inspecting} />

      {webgl !== "none" && products.length > 0 && (
        <BottomHud t={t} visible={!inspecting && revealed} index={Math.min(focusIndex, products.length - 1)} total={products.length} title={currentProduct?.title ?? ""} fmtNum={fmtNum} rtl={rtl} onPrev={() => controller.current?.stepVisual(-1)} onNext={() => controller.current?.stepVisual(1)} />
      )}

      {webgl !== "none" && products.length === 0 && loaded && <p className="sf-muted absolute inset-x-0 top-1/2 text-center">{t.noProducts}</p>}

      {/* floating editorial hover label */}
      {hoverProduct && hover && (
        <div key={hoverProduct.id} className="sf-rise pointer-events-none absolute z-20 -translate-x-1/2 text-center" style={{ left: hover.x, top: hover.y + 8 }}>
          <div className="sf-display text-2xl leading-none">{hoverProduct.title}</div>
          <div className="sf-label mt-1.5 tabular-nums">{money(hoverProduct.basePrice)}</div>
        </div>
      )}

      {product && (
        <Inspector
          key={product.id}
          t={t}
          product={product}
          has3d={webgl !== "none"}
          colorName={colorName}
          size={size}
          onColor={pickColor}
          onSize={setSize}
          money={money}
          view={view}
          onView={pickView}
          hotspotId={hotspotId}
          onHotspot={pickHotspot}
          onSizeGuide={() => setGuideOpen(true)}
          onAdd={addToBag}
          added={added}
          onBack={closeInspect}
          fmtNum={fmtNum}
        />
      )}
      {product && guideOpen && <SizeGuideModal t={t} product={product} onClose={() => setGuideOpen(false)} />}

      <Preloader brand={settings.brandName} logoUrl={settings.logoUrl} label={t.loading} progress={progress} ready={loaded} locale={intl} onDone={onRevealed} />
    </main>
  );
}

