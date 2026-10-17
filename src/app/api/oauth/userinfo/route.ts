import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { handler } from "@/lib/api";
import { db } from "@/lib/db";
import { oauthAccessTokens, users } from "@/lib/db/schema";
import { hashToken } from "@/lib/oauth";

export const dynamic = "force-dynamic";

function unauthorized(description: string) {
  return NextResponse.json(
    { error: "invalid_token", error_description: description },
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' },
    },
  );
}

/** 用 Bearer 令牌换取用户身份。客户端只在登录那一刻调用一次。 */
export const GET = handler(async (req: Request) => {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return unauthorized("缺少 Bearer 令牌");
  }

  const token = authHeader.slice(7).trim();
  if (!token) return unauthorized("令牌为空");

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      scope: oauthAccessTokens.scope,
      expiresAt: oauthAccessTokens.expiresAt,
    })
    .from(oauthAccessTokens)
    .innerJoin(users, eq(users.id, oauthAccessTokens.userId))
    .where(eq(oauthAccessTokens.tokenHash, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row) return unauthorized("令牌无效");
  if (row.expiresAt.getTime() < Date.now()) return unauthorized("令牌已过期");

  return NextResponse.json({
    sub: row.userId,
    email: row.email,
    email_verified: true,
    name: row.name,
    preferred_username: row.email.split("@")[0] ?? row.email,
    scope: row.scope,
  });
});
