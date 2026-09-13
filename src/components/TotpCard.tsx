"use client";

import { memo, useEffect, useState } from "react";

import { IconCheck, IconCopy, IconPencil, IconTrash } from "@/components/Icons";
import { toast } from "@/components/Toast";
import { avatarGradient, cn, copyText, initialsOf } from "@/lib/client";
import { clampPeriod, formatCode, generateTotp } from "@/lib/totp";
import type { TotpAccount } from "@/lib/types";

export const TotpCard = memo(function TotpCard({
  account,
  now,
  onEdit,
  onDelete,
}: {
  account: TotpAccount;
  now: number;
  onEdit: (account: TotpAccount) => void;
  onDelete: (account: TotpAccount) => void;
}) {
  const period = clampPeriod(account.period);
  const windowMs = period * 1000;
  const counter = Math.floor(now / windowMs);
  const remainingMs = windowMs - (now % windowMs);

  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    generateTotp(
      {
        secret: account.secret,
        algorithm: account.algorithm,
        digits: account.digits,
        period,
      },
      counter * windowMs,
    )
      .then((value) => {
        if (alive) setCode(value);
      })
      .catch(() => {
        if (alive) setCode("ERROR");
      });
    return () => {
      alive = false;
    };
  }, [counter, windowMs, account.secret, account.algorithm, account.digits, period]);

  const seconds = Math.ceil(remainingMs / 1000);
  const fraction = Math.max(0, Math.min(1, remainingMs / windowMs));
  const urgent = remainingMs <= 5000;

  async function handleCopy() {
    if (!code || code === "ERROR") return;
    const ok = await copyText(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } else {
      toast("复制失败，请手动选择验证码", "error");
    }
  }

  return (
    <div className="card group relative overflow-hidden p-4 transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-sm font-semibold text-white shadow-sm",
            avatarGradient(account.issuer || account.accountName),
          )}
        >
          {initialsOf(account.issuer || account.accountName)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">
            {account.issuer || "未命名服务"}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {account.accountName}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(account)}
            className="btn-ghost p-1.5"
            title="编辑"
            aria-label="编辑"
          >
            <IconPencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(account)}
            className="btn-danger p-1.5"
            title="删除"
            aria-label="删除"
          >
            <IconTrash className="size-4" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        title="点击复制验证码"
        className="mt-3 flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <span
          className={cn(
            "code-text text-[26px] font-semibold leading-none sm:text-[30px]",
            urgent
              ? "text-rose-600 dark:text-rose-400"
              : "text-slate-900 dark:text-slate-50",
          )}
        >
          {code === null ? (
            <span
              aria-label="正在计算验证码"
              className="inline-block h-[26px] w-[7.5ch] animate-pulse rounded-md bg-slate-200 align-middle sm:h-[30px] dark:bg-slate-700"
            />
          ) : code === "ERROR" ? (
            <span className="text-base font-normal text-rose-500">
              密钥无法生成验证码
            </span>
          ) : (
            formatCode(code)
          )}
        </span>
        <span className="ml-auto grid size-8 place-items-center rounded-lg text-slate-400 transition group-hover:text-slate-600 dark:group-hover:text-slate-300">
          {copied ? (
            <IconCheck className="size-4 text-emerald-500" />
          ) : (
            <IconCopy className="size-4" />
          )}
        </span>
      </button>

      <div className="mt-2.5 flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-200 ease-linear",
              urgent ? "bg-rose-500" : "bg-brand-500",
            )}
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
        <span
          className={cn(
            "w-7 text-right text-[11px] font-medium tabular-nums",
            urgent
              ? "text-rose-500"
              : "text-slate-400 dark:text-slate-500",
          )}
        >
          {seconds}s
        </span>
      </div>

      {account.note && (
        <p className="mt-2 truncate text-[11px] text-slate-400 dark:text-slate-500">
          {account.note}
        </p>
      )}
    </div>
  );
});
