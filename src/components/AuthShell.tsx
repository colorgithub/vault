import Link from "next/link";

import { IconKey, IconMemo, IconQr, IconShield } from "@/components/Icons";

const HIGHLIGHTS = [
  {
    icon: IconMemo,
    title: "备忘录随写随存",
    desc: "支持搜索、置顶、颜色分类与自动保存，多端同步。",
  },
  {
    icon: IconShield,
    title: "实时 2FA 验证码",
    desc: "TOTP 每秒刷新，环形进度条提示剩余时间，一键复制。",
  },
  {
    icon: IconQr,
    title: "扫码即导入",
    desc: "摄像头扫一扫，或上传二维码截图，兼容 Google 迁移码。",
  },
  {
    icon: IconKey,
    title: "账号彼此隔离",
    desc: "注册即用，每位用户的数据严格隔离，互不可见。",
  },
];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      {/* 背景装饰 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand-50 via-slate-50 to-sky-50 dark:from-slate-950 dark:via-slate-950 dark:to-brand-900/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 -z-10 size-96 rounded-full bg-brand-400/25 blur-3xl dark:bg-brand-600/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-24 -z-10 size-96 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-700/20"
      />

      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-2xl shadow-slate-900/5 backdrop-blur-xl md:grid-cols-2 dark:border-slate-800 dark:bg-slate-900/60">
        {/* 左侧介绍 */}
        <section className="relative hidden flex-col justify-between bg-gradient-to-br from-brand-600 to-brand-800 p-10 text-white md:flex">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <IconShield className="size-5" />
              </span>
              <span className="text-lg font-semibold tracking-tight">
                MemoVault
              </span>
            </Link>
            <h2 className="mt-10 text-3xl font-semibold leading-snug tracking-tight">
              备忘与两步验证，
              <br />
              收在一个干净的角落。
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
              不用在备忘录和验证器之间来回切换。登录一次，笔记在手，验证码实时跳动。
            </p>
          </div>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title: t, desc }) => (
              <li key={t} className="flex gap-3.5">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-white/12 ring-1 ring-white/20">
                  <Icon className="size-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-medium">{t}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/65">
                    {desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 右侧表单 */}
        <section className="p-8 sm:p-10">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 md:hidden"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <IconShield className="size-4.5" />
            </span>
            <span className="font-semibold tracking-tight">MemoVault</span>
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 mb-7 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>

          {children}
        </section>
      </div>
    </main>
  );
}
