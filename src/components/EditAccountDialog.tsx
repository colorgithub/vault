"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toast";
import { apiFetch } from "@/lib/client";
import { clampDigits, clampPeriod, normalizeAlgorithm } from "@/lib/totp";
import type { TotpAccount } from "@/lib/types";

const ALGORITHMS = ["SHA1", "SHA256", "SHA512"] as const;

export function EditAccountDialog({
  account,
  onClose,
  onSaved,
}: {
  account: TotpAccount | null;
  onClose: () => void;
  onSaved: (account: TotpAccount) => void;
}) {
  const [issuer, setIssuer] = useState("");
  const [accountName, setAccountName] = useState("");
  const [note, setNote] = useState("");
  const [algorithm, setAlgorithm] = useState("SHA1");
  const [digits, setDigits] = useState(6);
  const [period, setPeriod] = useState(30);
  const [secret, setSecret] = useState("");
  const [changeSecret, setChangeSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!account) return;
    setIssuer(account.issuer);
    setAccountName(account.accountName);
    setNote(account.note);
    setAlgorithm(normalizeAlgorithm(account.algorithm));
    setDigits(clampDigits(account.digits));
    setPeriod(clampPeriod(account.period));
    setSecret(account.secret);
    setChangeSecret(false);
    setSaving(false);
  }, [account]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!account) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ account: TotpAccount }>(
        `/api/totp/${account.id}`,
        {
          method: "PATCH",
          json: {
            issuer,
            accountName,
            note,
            algorithm,
            digits,
            period,
            ...(changeSecret ? { secret } : {}),
          },
        },
      );
      onSaved(res.account);
      toast("已保存修改");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "保存失败", "error");
      setSaving(false);
    }
  }

  return (
    <Modal
      open={account !== null}
      onClose={onClose}
      title="编辑账户"
      description={account?.issuer || account?.accountName}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              服务名称
            </span>
            <input
              className="field"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              maxLength={80}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              账号
            </span>
            <input
              className="field"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              maxLength={120}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            备注
          </span>
          <input
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              哈希算法
            </span>
            <select
              className="field py-2"
              value={algorithm}
              onChange={(e) => setAlgorithm(normalizeAlgorithm(e.target.value))}
            >
              {ALGORITHMS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              位数
            </span>
            <select
              className="field py-2"
              value={digits}
              onChange={(e) => setDigits(clampDigits(Number(e.target.value)))}
            >
              {[6, 7, 8].map((d) => (
                <option key={d} value={d}>
                  {d} 位
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              周期（秒）
            </span>
            <input
              type="number"
              className="field py-2"
              min={5}
              max={300}
              value={period}
              onChange={(e) => setPeriod(clampPeriod(Number(e.target.value)))}
            />
          </label>
        </div>

        <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/50">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300 accent-brand-600"
              checked={changeSecret}
              onChange={(e) => setChangeSecret(e.target.checked)}
            />
            修改密钥
          </label>
          {changeSecret && (
            <input
              className="field code-text mt-3 text-sm"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          )}
        </div>

        <button type="submit" className="btn-primary w-full py-3" disabled={saving}>
          {saving ? "保存中…" : "保存修改"}
        </button>
      </form>
    </Modal>
  );
}
