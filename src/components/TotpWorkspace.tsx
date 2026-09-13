"use client";

import { useMemo, useState } from "react";

import { AddAccountDialog } from "@/components/AddAccountDialog";
import { EditAccountDialog } from "@/components/EditAccountDialog";
import { IconPlus, IconQr, IconSearch, IconShield } from "@/components/Icons";
import { toast } from "@/components/Toast";
import { TotpCard } from "@/components/TotpCard";
import { apiFetch, useNow } from "@/lib/client";
import type { TotpAccount } from "@/lib/types";

export function TotpWorkspace({
  accounts,
  setAccounts,
}: {
  accounts: TotpAccount[];
  setAccounts: React.Dispatch<React.SetStateAction<TotpAccount[]>>;
}) {
  const now = useNow(250);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<TotpAccount | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.issuer.toLowerCase().includes(q) ||
        a.accountName.toLowerCase().includes(q) ||
        a.note.toLowerCase().includes(q),
    );
  }, [accounts, query]);

  async function handleDelete(account: TotpAccount) {
    if (
      !window.confirm(
        `确定删除「${account.issuer || account.accountName}」吗？删除后将无法再生成验证码。`,
      )
    ) {
      return;
    }
    try {
      await apiFetch(`/api/totp/${account.id}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      toast("已删除");
    } catch (err) {
      toast(err instanceof Error ? err.message : "删除失败", "error");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 工具栏 */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[12rem] flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            className="field py-2 pl-9 text-sm"
            placeholder="搜索服务或账号…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="btn-primary shrink-0 px-3.5 py-2"
        >
          <IconPlus className="size-[18px]" />
          添加账户
        </button>
      </div>

      {/* 内容 */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        {accounts.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-950/50 dark:text-brand-300">
              <IconShield className="size-8" />
            </span>
            <p className="text-base font-medium">还没有添加验证器</p>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              用摄像头扫一扫服务网站给出的二维码，
              <br />
              验证码就会在这里每秒实时刷新。
            </p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="btn-primary mt-2 px-5 py-2.5"
            >
              <IconQr className="size-[18px]" />
              扫码添加第一个账户
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">
            没有匹配「{query}」的账户
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((account) => (
              <TotpCard
                key={account.id}
                account={account}
                now={now}
                onEdit={setEditing}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <AddAccountDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(created) =>
          setAccounts((prev) => [...created, ...prev])
        }
      />

      <EditAccountDialog
        account={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved) =>
          setAccounts((prev) =>
            prev.map((a) => (a.id === saved.id ? saved : a)),
          )
        }
      />
    </div>
  );
}
