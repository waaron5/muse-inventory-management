import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    APP_MODE: process.env.APP_MODE || "production",
  },
  experimental: {
    proxyClientMaxBodySize: "15mb",
  },
};

export default nextConfig;
