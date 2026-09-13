import { handler, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await getSession();
  if (!session) return ok({ user: null });
  return ok({
    user: { id: session.userId, email: session.email, name: session.name },
  });
});
