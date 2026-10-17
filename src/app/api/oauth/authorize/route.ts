import { NextResponse } from "next/server";
import { lt } from "drizzle-orm";

import { handler } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { oauthCodes } from "@/lib/db/schema";
import {
  buildErrorRedirect,
  buildSuccessRedirect,
  findClient,
  hashToken,
  isRegisteredRedirectUri,
  normalizeScope,
  OAUTH_CODE_TTL_SECONDS,
  randomToken,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

/**
 * 用户在本站确认授权后，签发授权码并回跳客户端。
 *
 * 这里对表单里的每一个字段都重新校验一遍 —— 授权页的隐藏域是用户
 * 可以随意改的，不能因为「页面上已经校验过」就信任它们。
 */
export const POST = handler(async (req: Request) => {
  const form = await req.formData();
  const get = (key: string): string => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };

  const client = findClient(get("client_id"));
  if (!client) {
    return new NextResponse("未知的客户端", { status: 400 });
  }

  const redirectUri = get("redirect_uri");
  // redirect_uri 不合法时绝对不能重定向，否则就是开放重定向
  if (!redirectUri || !isRegisteredRedirectUri(client, redirectUri)) {
    return new NextResponse("回调地址不匹配", { status: 400 });
  }

  const state = get("state") || null;
  const decision = get("decision");

  if (decision !== "approve") {
    return NextResponse.redirect(
      buildErrorRedirect(redirectUri, "access_denied", "用户拒绝了授权", state),
      303,
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const scope = normalizeScope(get("scope"), client);
  if (!scope) {
    return NextResponse.redirect(
      buildErrorRedirect(redirectUri, "invalid_scope", "请求了不支持的权限范围", state),
      303,
    );
  }

  const codeChallenge = get("code_challenge");
  const codeChallengeMethod = get("code_challenge_method") || "S256";
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return NextResponse.redirect(
      buildErrorRedirect(redirectUri, "invalid_request", "PKCE 参数不合法", state),
      303,
    );
  }

  // 顺手清理过期授权码，避免这张表无限增长
  await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, new Date()));

  const code = randomToken(32);
  await db.insert(oauthCodes).values({
    codeHash: hashToken(code),
    clientId: client.clientId,
    userId: session.userId,
    redirectUri,
    scope,
    codeChallenge,
    codeChallengeMethod,
    expiresAt: new Date(Date.now() + OAUTH_CODE_TTL_SECONDS * 1000),
  });

  return NextResponse.redirect(buildSuccessRedirect(redirectUri, code, state), 303);
});
