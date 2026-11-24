import type { Metadata } from "next";
import { AuthForm } from "@/storefront/components/AuthForm";
import { SiteHeader } from "@/storefront/components/Hud";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <AuthForm mode="login" />
    </>
  );
}
