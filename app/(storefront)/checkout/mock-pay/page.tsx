import type { Metadata } from "next";
import { MockPay } from "@/storefront/components/MockPay";

export const metadata: Metadata = { title: "Test payment", robots: { index: false } };

export default function MockPayPage() {
  return <MockPay />;
}
