import { and, eq } from "drizzle-orm";

import { fail, handler, ok, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { memos } from "@/lib/db/schema";
import { generateShareKey, hashShareKey } from "@/lib/share-key";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 查询密钥状态。
 *
 * 只回答「开没开、什么时候开的」，既不回显哈希，也拿不回明文 ——
 * 明文只在创建 / 轮换那一次出现。想看内容就重新生成一把。
 */
export const GET = handler<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const rows = await db
    .select({
      shareKeyHash: memos.shareKeyHash,
      shareKeyCreatedAt: memos.shareKeyCreatedAt,
    })
    .from(memos)
    .where(and(eq(memos.id, id), eq(memos.userId, user.userId)))
    .limit(1);

  const memo = rows[0];
  if (!memo) return fail("备忘录不存在", 404);

  const res = ok({
    enabled: memo.shareKeyHash !== null,
    createdAt: memo.shareKeyHash ? memo.shareKeyCreatedAt : null,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
});

/**
 * 创建或轮换分享密钥。
 *
 * 每条备忘录最多一把：再次调用会覆盖旧哈希，旧链接当场失效。
 * 这是唯一能拿到明文的时机，响应带 no-store，避免被中间层缓存。
 */
export const POST = handler<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const key = generateShareKey();
  const now = new Date();

  const [row] = await db
    .update(memos)
    .set({ shareKeyHash: hashShareKey(key), shareKeyCreatedAt: now })
    .where(and(eq(memos.id, id), eq(memos.userId, user.userId)))
    .returning({ id: memos.id, shareKeyCreatedAt: memos.shareKeyCreatedAt });

  if (!row) return fail("备忘录不存在", 404);

  // 用请求头拼回对外地址：部署在反向代理 / Vercel 后面时，req.url 里的 host
  // 可能是内部地址，直接拼出来的分享链接用户打不开。
  const res = ok(
    {
      key,
      url: `${publicOrigin(req)}/api/share/${key}`,
      createdAt: row.shareKeyCreatedAt ?? now,
    },
    201,
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
});

/** 取第一个值并去掉空白，兼容 `a, b` 形式的转发头。 */
function firstHeader(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first ? first : null;
}

/** 计算对外可用的 origin，优先信任代理写入的 X-Forwarded-* 头。 */
function publicOrigin(req: Request): string {
  const host =
    firstHeader(req.headers.get("x-forwarded-host")) ??
    firstHeader(req.headers.get("host"));
  if (!host) return new URL(req.url).origin;
  const proto =
    firstHeader(req.headers.get("x-forwarded-proto")) ??
    (new URL(req.url).protocol.replace(":", "") || "https");
  return `${proto}://${host}`;
}

/**
 * 撤销分享：把哈希清空，现有链接立即失效。
 *
 * 幂等：没有密钥时也返回成功，前端不必先查状态再删。
 */
export const DELETE = handler<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const [row] = await db
    .update(memos)
    .set({ shareKeyHash: null, shareKeyCreatedAt: null })
    .where(and(eq(memos.id, id), eq(memos.userId, user.userId)))
    .returning({ id: memos.id });

  if (!row) return fail("备忘录不存在", 404);
  return ok({ success: true, enabled: false });
});
