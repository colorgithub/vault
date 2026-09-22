"use client";

import { useEffect, useState } from "react";

import { isUnsupportedEngine } from "@/lib/client";

/**
 * 低于受支持下限时的提示。
 *
 * 硬下限是 Chrome 49（URLSearchParams 引入版本）：更老的 WebView 上
 * otpauth 解析与 TOTP 完全无法工作。与其让用户面对一个白屏或半残的界面，
 * 不如直接说明原因与解决办法。
 */
export function UnsupportedBrowserNotice() {
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    setUnsupported(isUnsupportedEngine());
  }, []);

  if (!unsupported) return null;

  return (
    <div
      role="alert"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-white p-6 dark:bg-slate-950"
    >
      <div className="max-w-sm text-center">
        <h1 className="text-base font-medium text-slate-900 dark:text-slate-100">
          浏览器版本过低
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          当前 WebView 版本过旧，无法运行本应用（需要 Android System WebView
          49 及以上）。
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          请到应用商店更新「Android System WebView」或「Chrome」，
          也可以改用较新的浏览器打开。
        </p>
      </div>
    </div>
  );
}
