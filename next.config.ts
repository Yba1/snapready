import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "**.runflow.io" },
      { hostname: "**.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
