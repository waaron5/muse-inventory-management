import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    APP_MODE: process.env.APP_MODE || "production",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  experimental: {
    proxyClientMaxBodySize: "15mb",
  },
};

export default nextConfig;
