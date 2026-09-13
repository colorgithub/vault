import type { Metadata, Viewport } from "next";

import "./globals.css";
import { ThemeScript } from "@/components/ThemeScript";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "MemoVault";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} · 备忘录 & 验证器`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "现代化网页备忘录与 2FA 验证器：多账号隔离、实时验证码、二维码扫描导入。",
  applicationName: APP_NAME,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
