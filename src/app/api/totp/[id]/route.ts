import { and, eq } from "drizzle-orm";

import { ApiError, fail, handler, ok, optionalInt, readJson, requireUser, str } from "@/lib/api";
import { db } from "@/lib/db";
import { totpAccounts } from "@/lib/db/schema";
import {
  isValidBase32,
  MIN_SECRET_LENGTH,
  normalizeAlgorithm,
  normalizeBase32,
} from "@/lib/totp";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await readJson<Record<string, unknown>>(req);

  const patch: Partial<typeof totpAccounts.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body.issuer !== undefined) patch.issuer = str(body.issuer).trim().slice(0, 80);
  if (body.accountName !== undefined)
    patch.accountName = str(body.accountName).trim().slice(0, 120);
  if (body.note !== undefined) patch.note = str(body.note).slice(0, 500);
  if (body.algorithm !== undefined)
    patch.algorithm = normalizeAlgorithm(str(body.algorithm));
  // 非法值直接报错，不再静默替换成默认值（digits=99 曾会变成 6）
  const digits = optionalInt(body.digits, "验证码位数", 4, 10);
  if (digits !== undefined) patch.digits = digits;
  const period = optionalInt(body.period, "刷新周期", 5, 300);
  if (period !== undefined) patch.period = period;
  if (body.secret !== undefined) {
    const secret = normalizeBase32(str(body.secret));
    if (!isValidBase32(secret))
      throw new ApiError(
        `密钥无效，应为至少 ${MIN_SECRET_LENGTH} 位的 Base32 字符串`,
      );
    patch.secret = secret;
  }

  const [row] = await db
    .update(totpAccounts)
    .set(patch)
    .where(and(eq(totpAccounts.id, id), eq(totpAccounts.userId, user.userId)))
    .returning();

  if (!row) return fail("账户不存在", 404);
  return ok({ account: row });
});

export const DELETE = handler<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const deleted = await db
    .delete(totpAccounts)
    .where(and(eq(totpAccounts.id, id), eq(totpAccounts.userId, user.userId)))
    .returning({ id: totpAccounts.id });
  if (deleted.length === 0) return fail("账户不存在", 404);
  return ok({ success: true });
});
