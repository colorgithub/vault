import { redirect } from "next/navigation";

import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getSession } from "@/lib/auth";

export const metadata = { title: "登录" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/vault");

  return (
    <AuthShell title="欢迎回来" subtitle="登录后即可访问你的备忘录与验证码">
      <AuthForm mode="login" />
    </AuthShell>
  );
}
