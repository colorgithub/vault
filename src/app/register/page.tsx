import { redirect } from "next/navigation";

import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getSession } from "@/lib/auth";

export const metadata = { title: "注册" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/vault");

  return (
    <AuthShell
      title="创建你的账号"
      subtitle="只需邮箱与密码，数据即刻私有化保存"
    >
      <AuthForm mode="register" />
    </AuthShell>
  );
}
