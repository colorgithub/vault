import { redirect } from "next/navigation";

import { VaultApp } from "@/components/VaultApp";
import { getSession } from "@/lib/auth";

export const metadata = { title: "我的保险库" };
export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <VaultApp
      user={{ id: session.userId, email: session.email, name: session.name }}
    />
  );
}
