"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** 拼接 className */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
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
  const data = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T);

  if (!res.ok) {
    const message =
      (data as { error?: string })?.error || `请求失败（${res.status}）`;
    throw new Error(message);
  }
  return data as T;
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
