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
import { apiFetch, cn, initialsOf, useTheme } from "@/lib/client";
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
    a.download = `memovault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("备份文件已导出");
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
    <div className="flex h-full flex-col gap-1 p-3.5">
      <div className="mb-3 flex items-center justify-between px-1.5 pt-1">
        <span className="inline-flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm shadow-brand-600/30">
            <IconShield className="size-5" />
          </span>
          <span className="font-semibold tracking-tight">MemoVault</span>
        </span>
        <button
          type="button"
          className="btn-ghost p-2 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="关闭菜单"
        >
          <IconClose />
        </button>
      </div>

      <nav className="space-y-1">
        {navItems.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setSidebarOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
              tab === key
                ? "bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-950/50 dark:text-brand-300 dark:ring-brand-900/60"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/70",
            )}
            aria-current={tab === key ? "page" : undefined}
          >
            <Icon className="size-[18px]" />
            <span className="flex-1 text-left">{label}</span>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                tab === key
                  ? "bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
              )}
            >
              {count}
            </span>
          </button>
        ))}
      </nav>

      <div className="mt-4 px-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          当前账号
        </p>
        <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white">
            {initialsOf(user.name || user.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {user.email}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-1 pt-3">
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/70"
        >
          {theme === "dark" ? (
            <IconSun className="size-[18px]" />
          ) : (
            <IconMoon className="size-[18px]" />
          )}
          {theme === "dark" ? "浅色模式" : "深色模式"}
        </button>
        <button
          type="button"
          onClick={exportBackup}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/70"
        >
          <IconDownload className="size-[18px]" />
          导出备份
        </button>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
        >
          <IconLogout className="size-[18px]" />
          退出登录
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* 桌面端侧栏 */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
        {sidebar}
      </aside>

      {/* 移动端抽屉 */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="关闭菜单"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="animate-slide-up absolute inset-y-0 left-0 w-72 max-w-[85%] border-r border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 移动端顶栏 */}
        <header className="glass flex shrink-0 items-center gap-3 border-b border-slate-200 px-3 py-2.5 lg:hidden dark:border-slate-800">
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() => setSidebarOpen(true)}
            aria-label="打开菜单"
          >
            <IconMenu />
          </button>
          <span className="inline-flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <IconShield className="size-4" />
            </span>
            <span className="font-semibold tracking-tight">
              {tab === "memos" ? "备忘录" : "验证器"}
            </span>
          </span>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          {loading ? (
            <div className="grid flex-1 place-items-center">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <span className="size-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-500 dark:border-slate-700 dark:border-t-brand-400" />
                <p className="text-sm">正在加载你的数据…</p>
              </div>
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
