import type { ReactNode } from "react";
import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// Admin is its own root layout (the storefront's <html> carries the store's lang/dir from the database).
export default function AdminRoot({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
