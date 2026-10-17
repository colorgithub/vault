import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * 极简 OAuth 2.0 授权服务器实现（Authorization Code + PKCE）。
 *
 * 为什么不用现成库：这里只需要服务一个第一方客户端（博客），
 * 授权码 + PKCE + userinfo 三个端点就够，引入完整 OIDC 框架
 * 反而会把 Next.js 15 的 App Router 结构搞复杂。
 *
 * 安全要点：
 * - 授权码一次性使用、60 秒过期，库里只存 SHA-256 哈希
 * - 访问令牌同样只存哈希，泄露数据库也拿不到可用令牌
 * - PKCE 强制 S256，拒绝 plain
 * - client_secret 与 redirect_uri 都做恒定时间比较 / 严格匹配
 */

export const OAUTH_CODE_TTL_SECONDS = 60;
export const OAUTH_TOKEN_TTL_SECONDS = 60 * 60;

/**
 * 支持的范围。
 *
 * 刻意不声明 openid —— 那是 OIDC 的标记，一旦声明就必须签发 id_token。
 * 本实现是 OAuth 2.0 + userinfo，客户端拿 access_token 调 /api/oauth/userinfo
 * 取身份，语义上更诚实，也少一套密钥分发的麻烦。
 */
export const SUPPORTED_SCOPES = ["profile", "email"] as const;

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
  name: string;
  redirectUris: string[];
  scopes: string[];
}

/** 客户端注册表从环境变量读取，避免为一个第一方客户端再建一张表。 */
function parseClients(): OAuthClient[] {
  const raw = process.env.OAUTH_CLIENTS?.trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[oauth] OAUTH_CLIENTS 不是合法 JSON");
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.error("[oauth] OAUTH_CLIENTS 必须是数组");
    return [];
  }

  const clients: OAuthClient[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const clientId = typeof c.clientId === "string" ? c.clientId.trim() : "";
    const clientSecret = typeof c.clientSecret === "string" ? c.clientSecret : "";
    const redirectUris = Array.isArray(c.redirectUris)
      ? c.redirectUris.filter((u): u is string => typeof u === "string")
      : [];
    if (!clientId || !clientSecret || redirectUris.length === 0) {
      console.error("[oauth] 客户端配置不完整，已跳过：", clientId || "(无 clientId)");
      continue;
    }
    clients.push({
      clientId,
      clientSecret,
      name: typeof c.name === "string" && c.name ? c.name : clientId,
      redirectUris,
      scopes:
        Array.isArray(c.scopes) && c.scopes.length > 0
          ? c.scopes.filter((s): s is string => typeof s === "string")
          : [...SUPPORTED_SCOPES],
    });
  }
  return clients;
}

let cachedClients: { raw: string | undefined; value: OAuthClient[] } | null = null;

export function getClients(): OAuthClient[] {
  const raw = process.env.OAUTH_CLIENTS;
  if (cachedClients && cachedClients.raw === raw) return cachedClients.value;
  const value = parseClients();
  cachedClients = { raw, value };
  return value;
}

export function findClient(clientId: string | null): OAuthClient | null {
  if (!clientId) return null;
  return getClients().find((c) => c.clientId === clientId) ?? null;
}

/** 恒定时间字符串比较，避免通过响应时间逐字节猜 secret。 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** redirect_uri 必须与注册值完全一致，不做前缀/通配匹配。 */
export function isRegisteredRedirectUri(client: OAuthClient, uri: string): boolean {
  return client.redirectUris.includes(uri);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** PKCE S256 校验。按 RFC 7636 拒绝 plain 方法。 */
export function verifyPkce(
  verifier: string,
  challenge: string,
  method: string,
): boolean {
  if (method !== "S256") return false;
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const expected = createHash("sha256").update(verifier).digest("base64url");
  return safeEqual(expected, challenge);
}

/** 从环境变量取对外 issuer，未配置时回退到请求自身的 origin。 */
export function resolveIssuer(request: Request): string {
  const explicit = process.env.OAUTH_ISSUER?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

/** 校验请求的 scope，返回规范化后的字符串；含不支持的 scope 时返回 null。 */
export function normalizeScope(raw: string | null, client: OAuthClient): string | null {
  const requested = (raw ?? "profile email")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (requested.length === 0) return client.scopes.join(" ");

  const allowed = new Set(client.scopes);
  for (const scope of requested) {
    if (!allowed.has(scope)) return null;
  }
  // 去重并保持顺序
  return [...new Set(requested)].join(" ");
}

/**
 * 构造回传给客户端的错误重定向。
 *
 * 按 RFC 6749 §4.1.2.1，只有在 redirect_uri 已登记的情况下才允许
 * 把错误回传给该地址，否则必须直接把错误展示给用户，避免开放重定向。
 */
export function buildErrorRedirect(
  redirectUri: string,
  error: string,
  description: string,
  state: string | null,
): string {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

export function buildSuccessRedirect(
  redirectUri: string,
  code: string,
  state: string | null,
): string {
  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}
