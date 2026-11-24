import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import "../globals.css";
import "../../storefront/storefront.css";
import { getPublicSettings } from "@/server/services/storefront";

export const dynamic = "force-dynamic";

async function settingsOrNull() {
  try {
    return await getPublicSettings();
  } catch (e) {
    console.error("storefront: could not load settings", e);
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await settingsOrNull();
  return {
    title: s ? { default: s.brandName, template: `%s | ${s.brandName}` } : "Store",
    description: s?.tagline ?? undefined,
    icons: s?.faviconUrl ? { icon: s.faviconUrl } : undefined,
  };
}

/** Root layout for the storefront: <html lang/dir> and the brand theme come from store_settings. */
export default async function StorefrontRoot({ children }: { children: ReactNode }) {
  const s = await settingsOrNull();
  const theme = s?.brandTheme;
  const fa = s?.defaultLocale === "fa";
  const style = {
    "--sf-bg": theme?.background ?? "#0b0b0d",
    "--sf-fg": theme?.foreground ?? "#f2ece4",
    "--sf-accent": theme?.accent ?? "#c8a97e",
    "--sf-muted": theme?.muted ?? "#8b8b93",
    "--sf-radius": theme?.radius ?? "0.125rem",
    "--sf-font-display": `${theme?.fontDisplay ? `"${theme.fontDisplay}", ` : ""}${fa ? "Vazirmatn, Tahoma, " : ""}Georgia, serif`,
    "--sf-font-body": `${theme?.fontBody ? `"${theme.fontBody}", ` : ""}${fa ? "Vazirmatn, Tahoma, " : ""}ui-sans-serif, system-ui, sans-serif`,
  } as CSSProperties;

  return (
    <html lang={s?.defaultLocale ?? "en"} dir={s?.direction ?? "ltr"} style={style}>
      <body style={{ background: "var(--sf-bg)" }}>{children}</body>
    </html>
  );
}
