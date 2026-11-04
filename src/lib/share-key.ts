import { createHash, randomBytes } from "node:crypto";

/**
 * 备忘录分享密钥。
 *
 * 语义：一条备忘录最多一把「只读」密钥，凭它可以在不登录的情况下通过
 * `GET /api/share/<key>` 读出该备忘录的标题与正文。密钥由 32 字节随机数
 * 生成（256 位，不可枚举），数据库里只存 SHA-256 哈希 —— 即使整库泄露，
 * 也拿不到能直接使用的密钥。
 *
 * 为什么用哈希而不是直接存明文：分享链接一旦生成就长期有效，和密码一样
 * 属于凭据；拿它去哈希是零成本的，没有理由不这么做。
 *
 * 生成用 `randomBytes` 而不是 `crypto.randomUUID()`：UUIDv4 只有 122 位
 * 随机性，且格式固定，容易在日志/URL 里被误认为普通 id。
 */

/** 密钥前缀，便于在日志、审计里一眼认出这是可撤销的分享凭据。 */
export const SHARE_KEY_PREFIX = "mv_";

/** 32 字节 base64url 恰好 43 个字符。 */
const SHARE_KEY_BODY_LENGTH = 43;

const SHARE_KEY_BODY_RE = /^[A-Za-z0-9_-]{43}$/;

/** 生成一把新密钥，形如 `mv_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`。 */
export function generateShareKey(): string {
  return SHARE_KEY_PREFIX + randomBytes(32).toString("base64url");
}

/** 计算入库用的哈希。只存这个值，明文只在创建时返回一次。 */
export function hashShareKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * 规范化并校验外部传入的密钥。
 *
 * 先做格式校验再查库：格式不对的请求根本不需要碰数据库，既省一次查询，
 * 也让「乱填的 key」与「已撤销的 key」在行为上完全一致（都是 404）。
 * 返回 null 表示格式非法。
 */
export function normalizeShareKey(raw: string | null | undefined): string | null {
  const key = (raw ?? "").trim();
  if (!key.startsWith(SHARE_KEY_PREFIX)) return null;
  const body = key.slice(SHARE_KEY_PREFIX.length);
  if (body.length !== SHARE_KEY_BODY_LENGTH || !SHARE_KEY_BODY_RE.test(body)) {
    return null;
  }
  return key;
}
