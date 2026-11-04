"use client";

import { useCallback, useEffect, useState } from "react";

import {
  IconCheck,
  IconCopy,
  IconKey,
  IconRefresh,
  IconTrash,
} from "@/components/Icons";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toast";
import { apiFetch, cn, copyText } from "@/lib/client";

interface KeyStatus {
  enabled: boolean;
  createdAt: string | null;
  scopes?: string[];
}

/**
 * 账号 API 密钥面板。
 *
 * 明文只在「刚生成」这一次出现在界面上：关闭弹窗即丢弃，服务端也只有哈希，
 * 所以这里不做任何「再次查看」的入口 —— 想看只能重新生成（旧密钥当场失效）。
 */
export function ApiKeyDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  // 每次打开都重新拉状态，并清掉上一次留在内存里的明文
  useEffect(() => {
    if (!open) return;
    setFreshKey(null);
    setCopied(false);
    setOrigin(window.location.origin);

    let alive = true;
    setLoading(true);
    apiFetch<KeyStatus>("/api/account/key")
      .then((res) => {
        if (alive) setStatus(res);
      })
      .catch((err) => {
        if (!alive) return;
        setStatus(null);
        toast(err instanceof Error ? err.message : "读取密钥状态失败", "error");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open]);

  const create = useCallback(async () => {
    if (status?.enabled && !window.confirm("重新生成会让现有密钥立即失效，使用它的脚本会马上报 401。继续？")) {
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<{ key: string; createdAt: string }>(
        "/api/account/key",
        { method: "POST" },
      );
      setFreshKey(res.key);
      setCopied(false);
      setStatus({ enabled: true, createdAt: res.createdAt, scopes: ["memos:read"] });
      toast(status?.enabled ? "已重新生成，旧密钥已失效" : "密钥已生成");
    } catch (err) {
      toast(err instanceof Error ? err.message : "生成失败", "error");
    } finally {
      setBusy(false);
    }
  }, [status?.enabled]);

  const revoke = useCallback(async () => {
    if (!window.confirm("撤销后使用该密钥的脚本会立即失去访问权限。继续？")) return;
    setBusy(true);
    try {
      await apiFetch("/api/account/key", { method: "DELETE" });
      setFreshKey(null);
      setStatus({ enabled: false, createdAt: null });
      toast("密钥已撤销");
    } catch (err) {
      toast(err instanceof Error ? err.message : "撤销失败", "error");
    } finally {
      setBusy(false);
    }
  }, []);

  const copy = useCallback(async () => {
    if (!freshKey) return;
    const ok = await copyText(freshKey);
    if (ok) {
      setCopied(true);
      toast("已复制");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast("复制失败，请手动选中", "error");
    }
  }, [freshKey]);

  const enabled = !!status?.enabled;
  // 这里刻意用占位符而不是刚生成的明文：43 字符的密钥会把命令行撑到溢出，
  // 而密钥本身在上面的输入框里一键可复制。
  const usage = [
    "# 读取全部备忘录（只读）",
    'curl -H "Authorization: Bearer <key>" \\',
    `  ${origin}/api/memos`,
  ].join("\n");

  return (
    <Modal
      open={open}
      title="API 密钥"
      description="一把密钥即可只读访问本账号的全部备忘录。"
      onClose={onClose}
    >
      {loading ? (
        <div className="grid h-24 place-items-center">
          <span className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500 dark:border-slate-800 dark:border-t-slate-400" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-800">
            <div className="min-w-0">
              <p className="text-sm font-medium">{enabled ? "已开启" : "未开启"}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                {enabled && status?.createdAt
                  ? `创建于 ${new Date(status.createdAt).toLocaleString("zh-CN")}`
                  : "生成后可用于脚本或外部程序读取"}
              </p>
            </div>
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600",
              )}
            />
          </div>

          {freshKey && (
            <div className="rounded-lg border border-slate-900/10 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900">
              <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                新密钥（只显示这一次）
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={freshKey}
                  aria-label="API 密钥"
                  className="field code-text min-w-0 flex-1 text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={copy}
                  className="btn-outline shrink-0 px-2.5 py-2"
                  aria-label={copied ? "已复制" : "复制密钥"}
                >
                  {copied ? (
                    <IconCheck className="size-4" />
                  ) : (
                    <IconCopy className="size-4" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                关闭后无法再次查看，服务端只保存哈希 —— 请现在保存好。
              </p>
            </div>
          )}

          <pre className="scrollbar-thin overflow-x-auto rounded-lg bg-slate-900 px-3 py-2.5 text-[11px] leading-5 text-slate-300 dark:bg-slate-900">
            {usage}
          </pre>

          <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <li>· 只读：不能新建、修改或删除备忘录，也读不到验证码</li>
            <li>· 一个账号一把，重新生成后旧密钥立即失效</li>
            <li>· 字符串以 mv_ 开头，等同于密码，不要提交进 Git</li>
          </ul>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="btn-primary"
            >
              {enabled ? (
                <IconRefresh className="size-4" />
              ) : (
                <IconKey className="size-4" />
              )}
              {enabled ? "重新生成" : "生成密钥"}
            </button>
            {enabled && (
              <button
                type="button"
                onClick={revoke}
                disabled={busy}
                className="btn-danger"
              >
                <IconTrash className="size-4" />
                撤销
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
