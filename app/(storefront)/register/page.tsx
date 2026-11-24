import type { Metadata } from "next";
import { AuthForm } from "@/storefront/components/AuthForm";
import { SiteHeader } from "@/storefront/components/Hud";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <SiteHeader />
      <AuthForm mode="register" />
    </>
  );
}
