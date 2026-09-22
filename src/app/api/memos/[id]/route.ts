import { and, eq } from "drizzle-orm";

import { ApiError, fail, handler, ok, readJson, requireUser, str } from "@/lib/api";
import { isMemoColor, MAX_MEMO_LENGTH, MAX_TITLE_LENGTH } from "@/lib/constants";
import { db } from "@/lib/db";
import { memos } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function loadOwned(userId: string, id: string) {
  const rows = await db
    .select()
    .from(memos)
    .where(and(eq(memos.id, id), eq(memos.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export const GET = handler<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const memo = await loadOwned(user.userId, id);
  if (!memo) return fail("备忘录不存在", 404);
  return ok({ memo });
});

/** 局部更新；传入 version 可做乐观并发校验 */
export const PATCH = handler<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await readJson<Record<string, unknown>>(req);

  const existing = await loadOwned(user.userId, id);
  if (!existing) return fail("备忘录不存在", 404);

  const patch: Partial<typeof memos.$inferInsert> = { updatedAt: new Date() };

  if (body.title !== undefined) {
    const title = str(body.title);
    if (title.length > MAX_TITLE_LENGTH)
      throw new ApiError(`标题不能超过 ${MAX_TITLE_LENGTH} 个字符`);
    patch.title = title;
  }
  if (body.content !== undefined) {
    const content = str(body.content);
    if (content.length > MAX_MEMO_LENGTH)
      throw new ApiError(`内容不能超过 ${MAX_MEMO_LENGTH} 个字符`);
    patch.content = content;
  }
  if (body.color !== undefined) {
    if (!isMemoColor(body.color)) throw new ApiError("无效的颜色标签");
    patch.color = body.color;
  }
  if (body.pinned !== undefined) patch.pinned = body.pinned === true;

  // 与 POST 保持一致：不允许把标题和内容同时清空。否则用户清空两个输入框后，
  // 会留下一条空备忘录，而同样的状态用 POST 是建不出来的。
  const nextTitle = patch.title ?? existing.title;
  const nextContent = patch.content ?? existing.content;
  if (!nextTitle.trim() && !nextContent.trim())
    throw new ApiError("标题和内容不能同时为空");

  const [row] = await db
    .update(memos)
    .set(patch)
    .where(and(eq(memos.id, id), eq(memos.userId, user.userId)))
    .returning();

  return ok({ memo: row });
});

export const DELETE = handler<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const deleted = await db
    .delete(memos)
    .where(and(eq(memos.id, id), eq(memos.userId, user.userId)))
    .returning({ id: memos.id });
  if (deleted.length === 0) return fail("备忘录不存在", 404);
  return ok({ success: true });
});
