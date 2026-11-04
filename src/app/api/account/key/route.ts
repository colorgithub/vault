import { eq } from "drizzle-orm";

import { fail, handler, ok, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { generateApiKey, hashApiKey } from "@/lib/api-key";

export const dynamic = "force-dynamic";

/**
 * 账号级 API 密钥管理。
 *
 * 三个方法都只认登录会话（Cookie），API 密钥本身不能调用它们 ——
 * 否则一把泄露的密钥可以自己续期，撤销就失去意义了。
 *
 * 一个账号一把密钥，明文只在 POST 的响应里出现一次。
 */

/** 查询是否已开启 API 访问。不回显哈希，也拿不回明文。 */
export const GET = handler(async () => {
  const user = await requireUser();

  const rows = await db
    .select({
      apiKeyHash: users.apiKeyHash,
      apiKeyCreatedAt: users.apiKeyCreatedAt,
    })
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);

  const row = rows[0];
  if (!row) return fail("账号不存在", 404);

  const res = ok({
    enabled: row.apiKeyHash !== null,
    createdAt: row.apiKeyHash ? row.apiKeyCreatedAt : null,
    scopes: ["memos:read"],
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
});

/**
 * 创建 / 轮换密钥。再次调用会覆盖旧哈希，旧密钥当场失效。
 * 这是唯一能拿到明文的时机，响应带 no-store。
 */
export const POST = handler(async () => {
  const user = await requireUser();

  const key = generateApiKey();
  const now = new Date();

  const [row] = await db
    .update(users)
    .set({ apiKeyHash: hashApiKey(key), apiKeyCreatedAt: now })
    .where(eq(users.id, user.userId))
    .returning({ apiKeyCreatedAt: users.apiKeyCreatedAt });

  if (!row) return fail("账号不存在", 404);

  const res = ok(
    {
      key,
      createdAt: row.apiKeyCreatedAt ?? now,
      scopes: ["memos:read"],
      usage: 'curl -H "Authorization: Bearer <key>" /api/memos',
    },
    201,
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
});

/** 撤销：清空哈希，现有密钥立即失效。幂等。 */
export const DELETE = handler(async () => {
  const user = await requireUser();

  const [row] = await db
    .update(users)
    .set({ apiKeyHash: null, apiKeyCreatedAt: null })
    .where(eq(users.id, user.userId))
    .returning({ id: users.id });

  if (!row) return fail("账号不存在", 404);
  return ok({ success: true, enabled: false });
});
