"use client";

import { useState } from "react";

import { IconKey, IconQr, IconRefresh, IconSparkle } from "@/components/Icons";
import { Modal } from "@/components/Modal";
import { QrScanner } from "@/components/QrScanner";
import { toast } from "@/components/Toast";
import { apiFetch, cn } from "@/lib/client";
import {
  buildOtpauthUri,
  clampDigits,
  clampPeriod,
  generateSecret,
  normalizeAlgorithm,
  parseOtpUri,
  type ParsedOtpAccount,
} from "@/lib/totp";
import type { TotpAccount } from "@/lib/types";

type Tab = "scan" | "manual";

const ALGORITHMS = ["SHA1", "SHA256", "SHA512"] as const;

export function AddAccountDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (accounts: TotpAccount[]) => void;
}) {
  const [tab, setTab] = useState<Tab>("scan");

  // 扫码结果预览
  const [scannedRaw, setScannedRaw] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedOtpAccount[]>([]);

  // 手动表单
  const [issuer, setIssuer] = useState("");
  const [accountName, setAccountName] = useState("");
  const [secret, setSecret] = useState("");
  const [note, setNote] = useState("");
  const [algorithm, setAlgorithm] = useState<string>("SHA1");
  const [digits, setDigits] = useState(6);
  const [period, setPeriod] = useState(30);
  const [advanced, setAdvanced] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  function resetAll() {
    setScannedRaw(null);
    setParsed([]);
    setIssuer("");
    setAccountName("");
    setSecret("");
    setNote("");
    setAlgorithm("SHA1");
    setDigits(6);
    setPeriod(30);
    setAdvanced(false);
    setSubmitting(false);
  }

  function close() {
    resetAll();
    onClose();
  }

  function handleScanResult(text: string) {
    const found = parseOtpUri(text);
    if (found.length === 0) {
      toast("二维码内容不是有效的 2FA 链接", "error");
      return;
    }
    setScannedRaw(text);
    setParsed(found);
  }

  async function importScanned() {
    if (!scannedRaw) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ accounts: TotpAccount[]; count: number }>(
        "/api/totp",
        { method: "POST", json: { uri: scannedRaw } },
      );
      onCreated(res.accounts);
      toast(`已导入 ${res.count} 个账户`);
      close();
    } catch (err) {
      toast(err instanceof Error ? err.message : "导入失败", "error");
      setSubmitting(false);
    }
  }

  async function submitManual(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch<{ accounts: TotpAccount[] }>("/api/totp", {
        method: "POST",
        json: {
          issuer,
          accountName,
          secret,
          note,
          algorithm,
          digits,
          period,
        },
      });
      onCreated(res.accounts);
      toast("账户已添加");
      close();
    } catch (err) {
      toast(err instanceof Error ? err.message : "添加失败", "error");
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="添加 2FA 账户"
      description="扫描二维码自动识别，或手动输入密钥"
    >
      {/* 切换标签 */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {(
          [
            { key: "scan", label: "扫码导入", icon: IconQr },
            { key: "manual", label: "手动输入", icon: IconKey },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              tab === key
                ? "bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "scan" ? (
        parsed.length > 0 ? (
          <div className="animate-pop space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                识别到 {parsed.length} 个账户
              </p>
              <button
                type="button"
                onClick={() => {
                  setParsed([]);
                  setScannedRaw(null);
                }}
                className="btn-ghost px-2.5 py-1.5 text-xs"
              >
                <IconRefresh className="size-4" />
                重新扫描
              </button>
            </div>

            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {parsed.map((item, index) => (
                <li
                  key={`${item.secret}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-600 dark:bg-brand-950/60 dark:text-brand-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.issuer || "未命名服务"}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.accountName} · {item.algorithm} · {item.digits} 位 ·{" "}
                      {item.period}s
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => void importScanned()}
              disabled={submitting}
              className="btn-primary w-full py-3"
            >
              {submitting ? "导入中…" : `确认导入 ${parsed.length} 个账户`}
            </button>
          </div>
        ) : (
          <QrScanner onResult={handleScanResult} />
        )
      ) : (
        <form onSubmit={submitManual} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                服务名称
              </span>
              <input
                className="field"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="例如 GitHub"
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
                placeholder="例如 me@example.com"
                maxLength={120}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
              <span>
                密钥 <span className="text-rose-500">*</span>
              </span>
              <button
                type="button"
                onClick={() => setSecret(generateSecret())}
                className="inline-flex items-center gap-1 text-xs font-normal text-brand-600 hover:underline dark:text-brand-400"
              >
                <IconSparkle className="size-3.5" />
                随机生成
              </button>
            </span>
            <input
              className="field code-text text-sm"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="JBSWY3DPEHPK3PXP"
              required
              spellCheck={false}
              autoComplete="off"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Base32 格式，通常由服务端提供的二维码或密钥文本
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              备注（可选）
            </span>
            <input
              className="field"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：工作账号"
              maxLength={500}
            />
          </label>

          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            {advanced ? "收起高级设置" : "展开高级设置（算法 / 位数 / 周期）"}
          </button>

          {advanced && (
            <div className="animate-pop grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3 dark:bg-slate-800/50">
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
                  验证码位数
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
                  刷新周期（秒）
                </span>
                <input
                  type="number"
                  className="field py-2"
                  value={period}
                  min={5}
                  max={300}
                  onChange={(e) => setPeriod(clampPeriod(Number(e.target.value)))}
                />
              </label>
            </div>
          )}

          {secret.trim() && (
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                等价的 otpauth 链接（可导入其它验证器）
              </p>
              <p className="code-text break-all text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">
                {buildOtpauthUri({
                  issuer,
                  accountName,
                  secret,
                  algorithm,
                  digits,
                  period,
                })}
              </p>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full py-3"
            disabled={submitting}
          >
            {submitting ? "保存中…" : "保存账户"}
          </button>
        </form>
      )}
    </Modal>
  );
}
