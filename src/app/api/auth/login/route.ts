import { eq } from "drizzle-orm";

import { ApiError, fail, handler, ok, readJson, str } from "@/lib/api";
import { setSessionCookie, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * 用户不存在时用来「陪跑」的哈希，让登录耗时保持恒定，
 * 避免通过响应时间区分「邮箱是否已注册」。
 */
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("timing-equalizer-not-a-real-password");
  return dummyHashPromise;
}

export const POST = handler(async (req: Request) => {
  const body = await readJson<Record<string, unknown>>(req);
  const email = str(body.email).trim().toLowerCase();
  const password = str(body.password);

  if (!email || !password) throw new ApiError("请输入邮箱与密码");

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = rows[0];
  // 无论用户是否存在都执行一次同等开销的哈希校验
  const stored = user?.passwordHash ?? (await getDummyHash());
  const valid = await verifyPassword(password, stored);
  if (!user || !valid) return fail("邮箱或密码不正确", 401);

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  return ok({
    user: { id: user.id, email: user.email, name: user.name },
  });
});
