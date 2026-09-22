"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** 拼接 className */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type SettledResult<T> =
  | { status: "fulfilled"; value: T }
  | { status: "rejected"; reason: unknown };

/**
 * Promise.allSettled 的兼容版本。
 *
 * Promise.allSettled 需要 Chrome 76 / Android WebView 76，而本项目的目标是
 * Chrome 61。这里自己实现，避免为了一个 API 把兼容下限抬高 —— 也免得依赖
 * 内联 polyfill 的执行时机。
 *
 * 用元组类型保留各元素的具体类型，调用处不必再做断言。
 */
export async function settleAll<T extends readonly unknown[]>(
  promises: { [K in keyof T]: Promise<T[K]> },
): Promise<{ [K in keyof T]: SettledResult<T[K]> }> {
  const results = await Promise.all(
    (promises as readonly Promise<unknown>[]).map((p) =>
      p.then(
        (value): SettledResult<unknown> => ({ status: "fulfilled", value }),
        (reason): SettledResult<unknown> => ({ status: "rejected", reason }),
      ),
    ),
  );
  return results as { [K in keyof T]: SettledResult<T[K]> };
}

/** 统一 fetch 封装：自动带 cookie、抛出后端错误信息 */
export async function apiFetch<T>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    credentials: "same-origin",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });

  const text = await res.text();

  // 先看状态码、再解析内容：响应体不一定是 JSON（反向代理的 HTML 错误页、门户认证页等）。
  // 若无条件 JSON.parse，用户看到的会是 "Unexpected token '<'..." 这种莫名其妙的报错。
  let data: (T & { error?: string }) | null = null;
  let parseFailed = false;
  if (text) {
    try {
      data = JSON.parse(text) as T & { error?: string };
    } catch {
      parseFailed = true;
    }
  }

  if (!res.ok) {
    const message =
      data?.error ||
      (parseFailed
        ? `请求失败（${res.status}），服务端返回了非 JSON 响应`
        : `请求失败（${res.status}）`);
    throw new Error(message);
  }

  if (parseFailed) {
    throw new Error("服务端返回了非 JSON 响应，请稍后重试");
  }

  return (data ?? ({} as T)) as T;
}

/**
 * Web Crypto 的 subtle 接口只在安全上下文（HTTPS 或 localhost）可用。
 * 局域网里用 http:// 直接访问时它是 undefined，TOTP 会整体失效 —— 需要提前判断，
 * 否则用户只会看到每张卡片都写着「密钥无法生成验证码」，却不知道原因。
 */
export function hasWebCrypto(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.subtle !== "undefined" &&
    typeof globalThis.crypto.subtle.importKey === "function"
  );
}

/* -------------------------------------------------------------------------- */
/*                        低版本 WebView 能力探测                              */
/* -------------------------------------------------------------------------- */

export interface ClientCaps {
  webCrypto: boolean;
  displayCapture: boolean;
  clipboardRead: boolean;
  clipboardWrite: boolean;
  imageDecode: boolean;
  secureContext: boolean;
}

/**
 * 读取启动时由内联 polyfill 写入的能力标记（src/lib/polyfills.ts）。
 *
 * 旧 WebView 上某些 API 根本不存在（例如 getDisplayMedia 需要 Chrome 72）。
 * 与其让按钮点了没反应，不如按能力隐藏入口并说明原因。
 */
export function getClientCaps(): ClientCaps {
  if (typeof window === "undefined") {
    return {
      webCrypto: false,
      displayCapture: false,
      clipboardRead: false,
      clipboardWrite: false,
      imageDecode: false,
      secureContext: false,
    };
  }
  const injected = (window as unknown as { __mvCaps?: Partial<ClientCaps> })
    .__mvCaps;
  // polyfill 未执行时（例如被 CSP 拦截）退化为即时探测
  return {
    webCrypto: injected?.webCrypto ?? hasWebCrypto(),
    displayCapture:
      injected?.displayCapture ??
      !!navigator.mediaDevices?.getDisplayMedia,
    clipboardRead:
      injected?.clipboardRead ?? !!navigator.clipboard?.read,
    clipboardWrite:
      injected?.clipboardWrite ?? !!navigator.clipboard?.writeText,
    imageDecode:
      injected?.imageDecode ??
      (typeof Image !== "undefined" &&
        typeof Image.prototype.decode === "function"),
    secureContext: injected?.secureContext ?? !!window.isSecureContext,
  };
}

/**
 * 检测是否低于受支持的下限。
 *
 * `URLSearchParams` 是 Chrome 49 引入的，otpauth 解析完全依赖它；
 * 更老的引擎上应用无法工作，此时应给出明确提示而不是白屏。
 */
export function isUnsupportedEngine(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof URLSearchParams === "undefined" ||
    typeof Promise === "undefined" ||
    typeof requestAnimationFrame === "undefined"
  );
}

/** 每 interval 毫秒返回一次当前时间戳，用于驱动动态倒计时 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last >= intervalMs) {
        last = t;
        setNow(Date.now());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // 标签页切回来时立即刷新，避免验证码停在旧值
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return now;
}

export type ThemeMode = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const stored = localStorage.getItem("mv-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(stored ? (stored as ThemeMode) : prefersDark ? "dark" : "light");
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      localStorage.setItem("mv-theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  return { theme, toggle };
}

/** 复制到剪贴板，带降级方案 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 继续走降级 */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/** 相对时间：刚刚 / 5 分钟前 / 3 天前 */
export function relativeTime(input: string | number | Date): string {
  const time = new Date(input).getTime();
  const diff = Date.now() - time;
  if (!Number.isFinite(time)) return "";
  if (diff < 45_000) return "刚刚";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(time).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function initialsOf(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "?";
  const chars = Array.from(trimmed);
  return chars[0].toUpperCase();
}

/** 简易防抖 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** 列表过滤（标题 + 内容 + 发行方 + 账户名） */
export function useFilteredMemos<T extends { title: string; content: string }>(
  items: T[],
  query: string,
): T[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q),
    );
  }, [items, query]);
}
