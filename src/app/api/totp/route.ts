import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { ApiError, handler, ok, optionalInt, readJson, requireUser, str } from "@/lib/api";
import { db } from "@/lib/db";
import { totpAccounts } from "@/lib/db/schema";
import {
  clampDigits,
  clampPeriod,
  generateTotp,
  isValidBase32,
  MIN_SECRET_LENGTH,
  normalizeAlgorithm,
  normalizeBase32,
  parseOtpUri,
  parseOtpUriDetailed,
} from "@/lib/totp";

export const dynamic = "force-dynamic";

export interface AccountInput {
  issuer: string;
  accountName: string;
  secret: string;
  algorithm: string;
  digits: number;
  period: number;
  note: string;
}

function buildInput(raw: Record<string, unknown>): AccountInput {
  const secret = normalizeBase32(str(raw.secret));
  if (!isValidBase32(secret))
    throw new ApiError(
      `密钥无效，应为至少 ${MIN_SECRET_LENGTH} 位的 Base32 字符串`,
    );

  const issuer = str(raw.issuer).trim().slice(0, 80);
  const accountName =
    str(raw.accountName).trim().slice(0, 120) || issuer || "未命名账户";

  // 只在「确实提供了非法值」时报错，缺省则用默认值。
  // 以前是静默 clamp：客户端传 digits=99 会悄悄变成 6，前端以为设置生效了。
  const digits = optionalInt(raw.digits, "验证码位数", 4, 10) ?? clampDigits(6);
  const period = optionalInt(raw.period, "刷新周期", 5, 300) ?? clampPeriod(30);

  return {
    issuer,
    accountName,
    secret,
    algorithm: normalizeAlgorithm(str(raw.algorithm, "SHA1")),
    digits,
    period,
    note: str(raw.note).slice(0, 500),
  };
}

/** 列出全部 2FA 账户（含密钥，供前端实时计算验证码） */
export const GET = handler(async () => {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(totpAccounts)
    .where(eq(totpAccounts.userId, user.userId))
    .orderBy(desc(totpAccounts.createdAt));
  return ok({ accounts: rows });
});

/**
 * 新建。支持两种请求体：
 *   1. 单个：{ issuer, accountName, secret, ... }
 *   2. 批量：{ uri: "otpauth-migration://..." } 或 { accounts: [...] }
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);

  let inputs: AccountInput[] = [];

  if (typeof body.uri === "string") {
    const { accounts, error } = parseOtpUriDetailed(body.uri);
    if (accounts.length === 0)
      throw new ApiError(error ?? "无法识别该二维码内容，请确认是 otpauth:// 链接");
    inputs = accounts.map((p) => buildInput({ ...p, note: str(body.note) }));
  } else if (Array.isArray(body.accounts)) {
    inputs = body.accounts.map((item) =>
      buildInput((item ?? {}) as Record<string, unknown>),
    );
  } else {
    inputs = [buildInput(body)];
  }

  if (inputs.length === 0) throw new ApiError("没有可保存的账户");
  if (inputs.length > 100) throw new ApiError("单次最多导入 100 个账户");

  // 先校验所有密钥都能正常算码，避免存入坏数据
  await Promise.all(
    inputs.map((input) => generateTotp(input).catch(() => {
      throw new ApiError(`账户「${input.accountName}」的密钥无法生成验证码`);
    })),
  );

  const now = new Date();
  const rows = await db
    .insert(totpAccounts)
    .values(
      inputs.map((input) => ({
        id: randomUUID(),
        userId: user.userId,
        ...input,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .returning();

  return ok({ accounts: rows, count: rows.length }, 201);
});
