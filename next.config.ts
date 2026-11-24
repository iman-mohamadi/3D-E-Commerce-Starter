import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // three/ is plain TS shared by storefront + admin; transpile it as part of the app.
  serverExternalPackages: ["postgres"],
};

export default config;
