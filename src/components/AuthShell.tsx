import Link from "next/link";

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
    <main className="flex min-h-dvh flex-col px-6">
      <header className="py-6">
        <Link
          href="/"
          className="text-sm font-medium tracking-tight text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          MemoVault
        </Link>
      </header>

      <div className="flex flex-1 items-start justify-center pb-24 pt-8 sm:pt-16">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 mb-7 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
          {children}
        </div>
      </div>
    </main>
  );
}
