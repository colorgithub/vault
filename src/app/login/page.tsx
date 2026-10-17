import { redirect } from "next/navigation";

import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getSession } from "@/lib/auth";
import { safeReturnPath } from "@/lib/redirect";

export const metadata = { title: "登录" };
export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = safeReturnPath(first(sp.next), "/vault");

  // 已登录时直接回到目标页（OAuth 授权页会在此刻继续往下走）
  const session = await getSession();
  if (session) redirect(next);

  return (
    <AuthShell title="欢迎回来" subtitle="登录后即可访问你的备忘录与验证码">
      <AuthForm mode="login" next={next} />
    </AuthShell>
  );
}
