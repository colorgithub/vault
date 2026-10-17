import { NextResponse } from "next/server";
import { and, eq, isNull, lt } from "drizzle-orm";

import { handler } from "@/lib/api";
import { db } from "@/lib/db";
import { oauthAccessTokens, oauthCodes } from "@/lib/db/schema";
import {
  findClient,
  hashToken,
  OAUTH_TOKEN_TTL_SECONDS,
  randomToken,
  safeEqual,
  verifyPkce,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status });
}

/** 解析请求参数，兼容标准 form-urlencoded 与 JSON（后者方便本地调试）。 */
async function readParams(req: Request): Promise<Record<string, string>> {
  const params: Record<string, string> = {};
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    if (body && typeof body === "object" && !Array.isArray(body)) {
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === "string") params[key] = value;
      }
    }
    return params;
  }

  const form = await req.formData().catch(() => null);
  if (form) {
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") params[key] = value;
    }
  }
  return params;
}

/**
 * 用授权码换访问令牌。
 *
 * 校验顺序刻意从严：客户端认证 → grant 类型 → 授权码状态 → 绑定关系 →
 * PKCE。任何一步不过都不签发令牌。
 */
export const POST = handler(async (req: Request) => {
  const params = await readParams(req);

  // 客户端认证：优先 client_secret_basic，其次 client_secret_post
  let clientId = params.client_id ?? "";
  let clientSecret = params.client_secret ?? "";

  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = Buffer.from(authHeader.slice(6).trim(), "base64").toString("utf8");
      const sep = decoded.indexOf(":");
      if (sep !== -1) {
        clientId = decodeURIComponent(decoded.slice(0, sep));
        clientSecret = decodeURIComponent(decoded.slice(sep + 1));
      }
    } catch {
      /* 解不出来就按未认证处理 */
    }
  }

  const client = findClient(clientId);
  if (!client || !safeEqual(client.clientSecret, clientSecret)) {
    return oauthError("invalid_client", "客户端认证失败", 401);
  }

  if (params.grant_type !== "authorization_code") {
    return oauthError("unsupported_grant_type", "只支持 authorization_code");
  }

  const code = params.code ?? "";
  const codeVerifier = params.code_verifier ?? "";
  const redirectUri = params.redirect_uri ?? "";

  if (!code || !codeVerifier) {
    return oauthError("invalid_request", "缺少 code 或 code_verifier");
  }

  const codeHash = hashToken(code);
  const rows = await db
    .select()
    .from(oauthCodes)
    .where(eq(oauthCodes.codeHash, codeHash))
    .limit(1);
  const row = rows[0];

  if (!row) return oauthError("invalid_grant", "授权码无效");
  if (row.consumedAt) return oauthError("invalid_grant", "授权码已被使用");
  if (row.expiresAt.getTime() < Date.now()) {
    return oauthError("invalid_grant", "授权码已过期");
  }
  if (row.clientId !== client.clientId) {
    return oauthError("invalid_grant", "授权码与客户端不匹配");
  }
  if (row.redirectUri !== redirectUri) {
    return oauthError("invalid_grant", "redirect_uri 与授权时不一致");
  }
  if (!verifyPkce(codeVerifier, row.codeChallenge, row.codeChallengeMethod)) {
    return oauthError("invalid_grant", "PKCE 校验失败");
  }

  // 原子地把授权码标记为已消费：带 consumed_at IS NULL 条件，
  // 并发重放时只有第一个请求能拿到 returning 结果。
  const consumed = await db
    .update(oauthCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(oauthCodes.codeHash, codeHash), isNull(oauthCodes.consumedAt)))
    .returning({ codeHash: oauthCodes.codeHash });

  if (consumed.length === 0) {
    return oauthError("invalid_grant", "授权码已被使用");
  }

  // 顺手清理过期数据
  const now = new Date();
  await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, now));
  await db.delete(oauthAccessTokens).where(lt(oauthAccessTokens.expiresAt, now));

  const accessToken = randomToken(32);
  const expiresAt = new Date(Date.now() + OAUTH_TOKEN_TTL_SECONDS * 1000);

  await db.insert(oauthAccessTokens).values({
    tokenHash: hashToken(accessToken),
    clientId: client.clientId,
    userId: row.userId,
    scope: row.scope,
    expiresAt,
  });

  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: OAUTH_TOKEN_TTL_SECONDS,
    scope: row.scope,
  });
});
