import { handler, ok } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  await clearSessionCookie();
  return ok({ success: true });
});
