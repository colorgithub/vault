import Link from "next/link";
import { redirect } from "next/navigation";

import {
  IconCamera,
  IconKey,
  IconMemo,
  IconQr,
  IconShield,
  IconSparkle,
} from "@/components/Icons";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: IconMemo,
    title: "备忘录",
    desc: "新建、编辑、置顶、颜色分类、全文搜索，输入即自动保存。",
  },
  {
    icon: IconShield,
    title: "2FA 验证码",
    desc: "TOTP 实时刷新，精度到秒，附带环形倒计时与一键复制。",
  },
  {
    icon: IconCamera,
    title: "二维码扫描",
    desc: "调用摄像头实时识别，也可上传截图解析，支持批量迁移码。",
  },
  {
    icon: IconKey,
    title: "多账号隔离",
    desc: "注册即用，每位用户只看得见自己的数据，互不干扰。",
  },
];

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/vault");

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white via-brand-50/50 to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-12rem] -z-10 size-[38rem] -translate-x-1/2 rounded-full bg-brand-400/20 blur-[120px] dark:bg-brand-600/20"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="inline-flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
            <IconShield className="size-5" />
          </span>
          <span className="font-semibold tracking-tight">MemoVault</span>
        </span>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">
            登录
          </Link>
          <Link href="/register" className="btn-primary">
            免费注册
          </Link>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-4xl px-6 pb-16 pt-14 text-center sm:pt-20">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-brand-700 backdrop-blur dark:border-brand-800 dark:bg-slate-900/60 dark:text-brand-300">
          <IconSparkle className="size-3.5" />
          备忘录 + 验证器，一个页面搞定
        </span>

        <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.15] tracking-tight sm:text-6xl">
          把笔记和
          <span className="bg-gradient-to-r from-brand-500 to-sky-500 bg-clip-text text-transparent">
            两步验证码
          </span>
          <br className="hidden sm:block" />
          放在同一个安全角落
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
          打开即写的备忘录，秒级刷新的 TOTP 验证码，扫一扫就能导入。
          注册一个账号，你的所有内容都会各自独立、互不可见地保存好。
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">
            立即创建账号
          </Link>
          <Link href="/login" className="btn-outline px-6 py-3 text-base">
            已有账号，去登录
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="card group p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 transition group-hover:bg-brand-100 dark:bg-brand-950/50 dark:text-brand-300 dark:ring-brand-900/60">
              <Icon className="size-5" />
            </span>
            <h2 className="mt-4 font-semibold tracking-tight">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {desc}
            </p>
          </div>
        ))}
      </section>

      <footer className="border-t border-slate-200/70 py-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-500">
        <p className="inline-flex items-center gap-1.5">
          <IconQr className="size-3.5" />
          MemoVault · 使用 Next.js 构建，可一键部署到 Vercel
        </p>
      </footer>
    </main>
  );
}
