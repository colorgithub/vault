import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["postgres"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // 不使用摄像头；屏幕捕获仅允许同源（用于扫描屏幕上的二维码）
            value: "camera=(), microphone=(), geolocation=(), display-capture=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
