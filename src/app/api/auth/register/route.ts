import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { ApiError, fail, handler, ok, readJson, str } from "@/lib/api";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const POST = handler(async (req: Request) => {
  const body = await readJson<Record<string, unknown>>(req);
  const email = str(body.email).trim().toLowerCase();
  const name = str(body.name).trim();
  const password = str(body.password);

  if (!EMAIL_RE.test(email)) throw new ApiError("请输入有效的邮箱地址");
  if (name.length < 1 || name.length > 40)
    throw new ApiError("昵称长度需在 1-40 个字符之间");
  if (password.length < 8) throw new ApiError("密码至少需要 8 位");
  if (password.length > 200) throw new ApiError("密码过长");

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) return fail("该邮箱已被注册", 409);

  const id = randomUUID();
  const passwordHash = await hashPassword(password);

  try {
    await db.insert(users).values({ id, email, name, passwordHash });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "23505") return fail("该邮箱已被注册", 409);
    throw err;
  }

  await setSessionCookie({ userId: id, email, name });
  return ok({ user: { id, email, name } }, 201);
});
