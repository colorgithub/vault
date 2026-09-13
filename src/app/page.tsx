import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/vault");

  return (
    <main className="flex min-h-dvh flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-sm font-medium tracking-tight">MemoVault</span>
        <nav className="flex items-center gap-1">
          <Link href="/login" className="btn-ghost">
            登录
          </Link>
          <Link href="/register" className="btn-primary">
            注册
          </Link>
        </nav>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center pb-24 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          备忘录与两步验证
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          随手记录，实时验证码，截图即可导入。注册一个账号，数据彼此隔离。
        </p>
        <div className="mt-8 flex items-center gap-2">
          <Link href="/register" className="btn-primary px-5 py-2.5">
            创建账号
          </Link>
          <Link href="/login" className="btn-outline px-5 py-2.5">
            登录
          </Link>
        </div>
      </div>
    </main>
  );
}
