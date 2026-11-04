import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { fail, handler } from "@/lib/api";
import { db } from "@/lib/db";
import { memos } from "@/lib/db/schema";
import { hashShareKey, normalizeShareKey } from "@/lib/share-key";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ key: string }> };

/**
 * 分享内容在任何一层都不该被缓存：撤销必须立即生效，
 * 也不能让搜索引擎把「本应私有」的正文收进索引。
 */
const PUBLIC_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
} as const;

/**
 * 凭分享密钥公开读取备忘录内容。
 *
 * 不需要登录、不读 Cookie —— 密钥本身就是凭据。所以只返回「阅读所需」的字段，
 * 用户 id、密钥哈希等一律不出现在响应里。
 *
 * `?format=text` 直接返回纯文本正文，方便 `curl` 或脚本取用；默认返回 JSON。
 */
export const GET = handler<Ctx>(async (req, ctx) => {
  const { key } = await ctx.params;

  // 格式不对的 key 根本不必查库；与「已撤销」返回同样的 404，不给探测空间。
  const normalized = normalizeShareKey(key);
  if (!normalized) return notFound();

  const rows = await db
    .select({
      id: memos.id,
      title: memos.title,
      content: memos.content,
      color: memos.color,
      pinned: memos.pinned,
      updatedAt: memos.updatedAt,
    })
    .from(memos)
    .where(eq(memos.shareKeyHash, hashShareKey(normalized)))
    .limit(1);

  const memo = rows[0];
  if (!memo) return notFound();

  const format = new URL(req.url).searchParams.get("format");
  if (format === "text" || format === "plain") {
    return new NextResponse(memo.content, {
      headers: {
        ...PUBLIC_HEADERS,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return NextResponse.json({ memo }, { headers: PUBLIC_HEADERS });
});

function notFound() {
  const res = fail("分享链接无效或已被撤销", 404);
  for (const [key, value] of Object.entries(PUBLIC_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}
