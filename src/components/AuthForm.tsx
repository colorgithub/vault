"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconEye, IconEyeOff } from "@/components/Icons";
import { apiFetch } from "@/lib/client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const isRegister = mode === "register";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        json: isRegister ? { name, email, password } : { email, password },
      });
      router.replace("/vault");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请稍后重试");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isRegister && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
            昵称
          </span>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="怎么称呼你"
            autoComplete="nickname"
            maxLength={40}
            required
          />
        </label>
      )}

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
          邮箱
        </span>
        <input
          className="field"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
          密码
        </span>
        <div className="relative">
          <input
            className="field pr-10"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isRegister ? "至少 8 位" : "请输入密码"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={isRegister ? 8 : undefined}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
          >
            {showPassword ? (
              <IconEyeOff className="size-4" />
            ) : (
              <IconEye className="size-4" />
            )}
          </button>
        </div>
      </label>

      {error && (
        <p
          role="alert"
          className="animate-pop rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn-primary w-full py-2.5"
        disabled={loading}
      >
        {loading ? "处理中…" : isRegister ? "创建账号" : "登录"}
      </button>

      <p className="pt-1 text-center text-xs text-slate-500 dark:text-slate-400">
        {isRegister ? "已有账号？" : "还没有账号？"}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="ml-1 underline underline-offset-2 transition hover:text-slate-900 dark:hover:text-slate-100"
        >
          {isRegister ? "去登录" : "注册"}
        </Link>
      </p>
    </form>
  );
}
