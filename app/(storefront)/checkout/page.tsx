import type { Metadata } from "next";
import { CheckoutClient } from "@/storefront/components/CheckoutClient";
import { SiteHeader } from "@/storefront/components/Hud";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <>
      <SiteHeader />
      <CheckoutClient defaultCountry="" />
    </>
  );
}
