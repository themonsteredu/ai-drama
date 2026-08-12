import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
