"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconEye, IconEyeOff, IconLock, IconMail, IconUser } from "@/components/Icons";
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
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            昵称
          </span>
          <div className="relative">
            <IconUser className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field pl-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="怎么称呼你？"
              autoComplete="nickname"
              maxLength={40}
              required
            />
          </div>
        </label>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          邮箱
        </span>
        <div className="relative">
          <IconMail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="field pl-11"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          密码
        </span>
        <div className="relative">
          <IconLock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="field px-11"
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
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
          >
            {showPassword ? <IconEyeOff /> : <IconEye />}
          </button>
        </div>
      </label>

      {error && (
        <p
          role="alert"
          className="animate-pop rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
        {loading ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            处理中…
          </>
        ) : isRegister ? (
          "创建账号"
        ) : (
          "登录"
        )}
      </button>

      <p className="pt-1 text-center text-sm text-slate-500 dark:text-slate-400">
        {isRegister ? "已经有账号了？" : "还没有账号？"}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="ml-1 font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          {isRegister ? "去登录" : "免费注册"}
        </Link>
      </p>
    </form>
  );
}
