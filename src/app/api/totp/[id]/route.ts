import { and, eq } from "drizzle-orm";

import { ApiError, fail, handler, ok, readJson, requireUser, str } from "@/lib/api";
import { db } from "@/lib/db";
import { totpAccounts } from "@/lib/db/schema";
import {
  clampDigits,
  clampPeriod,
  isValidBase32,
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
  if (body.digits !== undefined) patch.digits = clampDigits(Number(body.digits));
  if (body.period !== undefined) patch.period = clampPeriod(Number(body.period));
  if (body.secret !== undefined) {
    const secret = normalizeBase32(str(body.secret));
    if (!isValidBase32(secret))
      throw new ApiError("密钥无效，应为至少 16 位的 Base32 字符串");
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
