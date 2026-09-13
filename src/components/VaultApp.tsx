"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  IconClose,
  IconDownload,
  IconLogout,
  IconMemo,
  IconMenu,
  IconMoon,
  IconShield,
  IconSun,
} from "@/components/Icons";
import { MemoWorkspace } from "@/components/MemoWorkspace";
import { Toaster, toast } from "@/components/Toast";
import { TotpWorkspace } from "@/components/TotpWorkspace";
import { apiFetch, cn, useTheme } from "@/lib/client";
import type { Memo, TotpAccount, User } from "@/lib/types";

type Tab = "memos" | "totp";

export function VaultApp({ user }: { user: User }) {
  const router = useRouter();
  const { theme, toggle } = useTheme();

  const [tab, setTab] = useState<Tab>("memos");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [memos, setMemos] = useState<Memo[]>([]);
  const [accounts, setAccounts] = useState<TotpAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [memoRes, totpRes] = await Promise.all([
          apiFetch<{ memos: Memo[] }>("/api/memos"),
          apiFetch<{ accounts: TotpAccount[] }>("/api/totp"),
        ]);
        if (!alive) return;
        setMemos(memoRes.memos);
        setAccounts(totpRes.accounts);
      } catch (err) {
        if (alive) {
          toast(err instanceof Error ? err.message : "加载失败", "error");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* 无论成功与否都回到登录页 */
    }
    router.replace("/login");
    router.refresh();
  }, [router]);

  const exportBackup = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      user: { email: user.email, name: user.name },
      memos,
      totp: accounts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memovault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("备份已导出");
  }, [accounts, memos, user]);

  const navItems: Array<{
    key: Tab;
    label: string;
    icon: typeof IconMemo;
    count: number;
  }> = [
    { key: "memos", label: "备忘录", icon: IconMemo, count: memos.length },
    { key: "totp", label: "验证器", icon: IconShield, count: accounts.length },
  ];

  const sidebar = (
    <div className="flex h-full flex-col p-3">
      <div className="mb-5 flex items-center justify-between px-2 pt-2">
        <span className="text-sm font-medium tracking-tight">MemoVault</span>
        <button
          type="button"
          className="btn-ghost p-1.5 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="关闭菜单"
        >
          <IconClose className="size-4" />
        </button>
      </div>

      <nav className="space-y-0.5">
        {navItems.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setSidebarOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
              tab === key
                ? "bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100",
            )}
            aria-current={tab === key ? "page" : undefined}
          >
            <Icon className="size-4" />
            <span className="flex-1 text-left">{label}</span>
            <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
              {count || ""}
            </span>
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-0.5 pt-4">
        <div className="mb-2 flex items-center gap-2.5 px-2.5 py-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
              {user.name}
            </p>
            <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
              {user.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
        >
          {theme === "dark" ? (
            <IconSun className="size-4" />
          ) : (
            <IconMoon className="size-4" />
          )}
          {theme === "dark" ? "浅色模式" : "深色模式"}
        </button>
        <button
          type="button"
          onClick={exportBackup}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
        >
          <IconDownload className="size-4" />
          导出备份
        </button>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-rose-400"
        >
          <IconLogout className="size-4" />
          退出登录
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-white dark:bg-slate-950">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 lg:block dark:border-slate-800">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="关闭菜单"
            className="absolute inset-0 bg-slate-900/20 dark:bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="animate-slide-up absolute inset-y-0 left-0 w-64 max-w-[80%] border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-2 lg:hidden dark:border-slate-800">
          <button
            type="button"
            className="btn-ghost p-1.5"
            onClick={() => setSidebarOpen(true)}
            aria-label="打开菜单"
          >
            <IconMenu className="size-5" />
          </button>
          <span className="text-sm font-medium">
            {tab === "memos" ? "备忘录" : "验证器"}
          </span>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          {loading ? (
            <div className="grid flex-1 place-items-center">
              <span className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500 dark:border-slate-800 dark:border-t-slate-400" />
            </div>
          ) : tab === "memos" ? (
            <MemoWorkspace memos={memos} setMemos={setMemos} />
          ) : (
            <TotpWorkspace accounts={accounts} setAccounts={setAccounts} />
          )}
        </main>
      </div>

      <Toaster />
    </div>
  );
}
