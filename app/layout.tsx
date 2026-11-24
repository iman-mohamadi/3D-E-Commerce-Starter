import type { ReactNode } from "react";

// Phase 2 replaces this with a settings-driven layout (brand theme, lang/dir from store_settings).
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
