import { createHash, randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * 账号级 API 密钥。
 *
 * 一把密钥对应一个账号，可以在不登录的情况下**只读**访问该账号的全部备忘录。
 * 典型用途：脚本 / 外部程序定时拉取内容、给静态站点生成器喂数据。
 *
 * 安全约定：
 * - 32 字节随机数（256 位），不可枚举
 * - 数据库只存 SHA-256 哈希；明文只在创建 / 轮换那一次返回
 * - 只读：不能写备忘录，也不能管理密钥本身（否则被偷的密钥还能自我续期）
 * - 一个账号一把，重新生成即轮换，旧密钥立刻失效
 */

/** 前缀便于在日志、密钥扫描器里识别出这是可撤销的 API 凭据。 */
export const API_KEY_PREFIX = "mv_";

/** 32 字节 base64url 恰好 43 个字符。 */
const API_KEY_BODY_LENGTH = 43;
const API_KEY_BODY_RE = /^[A-Za-z0-9_-]{43}$/;

export function generateApiKey(): string {
  return API_KEY_PREFIX + randomBytes(32).toString("base64url");
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * 校验外部传入的密钥格式。
 *
 * 格式不对就不必查库 —— 这类请求与「密钥已被撤销」在结果上完全一致（401），
 * 不给探测留任何差异。
 */
export function normalizeApiKey(raw: string | null | undefined): string | null {
  const key = (raw ?? "").trim();
  if (!key.startsWith(API_KEY_PREFIX)) return null;
  const body = key.slice(API_KEY_PREFIX.length);
  if (body.length !== API_KEY_BODY_LENGTH || !API_KEY_BODY_RE.test(body)) {
    return null;
  }
  return key;
}

/** 从 `Authorization: Bearer <key>` 里取出密钥；没有或格式不对返回 null。 */
export function readBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/** 按密钥哈希查用户；密钥无效返回 null。查询走唯一索引，不泄露任何账号信息。 */
export async function findUserByApiKey(
  key: string,
): Promise<{ id: string; email: string; name: string } | null> {
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.apiKeyHash, hashApiKey(key)))
    .limit(1);

  return rows[0] ?? null;
}
