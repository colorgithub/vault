import { redirect } from "next/navigation";

import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getSession } from "@/lib/auth";
import { safeReturnPath } from "@/lib/redirect";

export const metadata = { title: "注册" };
export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = safeReturnPath(first(sp.next), "/vault");

  const session = await getSession();
  if (session) redirect(next);

  return (
    <AuthShell
      title="创建你的账号"
      subtitle="只需邮箱与密码，数据即刻私有化保存"
    >
      <AuthForm mode="register" next={next} />
    </AuthShell>
  );
}
