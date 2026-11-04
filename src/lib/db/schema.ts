import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** 用户表 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** 备忘录表 */
export const memos = pgTable(
  "memos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""),
    color: text("color").notNull().default("slate"),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * 分享密钥的 SHA-256 哈希（见 src/lib/share-key.ts）。
     * 不存明文：明文只在创建 / 轮换时返回一次，之后无法再取回，只能重新生成。
     * NULL 表示该备忘录未开启分享。
     */
    shareKeyHash: text("share_key_hash").unique(),
    shareKeyCreatedAt: timestamp("share_key_created_at", { withTimezone: true }),
  },
  (t) => [index("memos_user_updated_idx").on(t.userId, t.updatedAt)],
);

/**
 * 对外返回的 memo 列。
 *
 * 刻意不包含 share_key_hash：分享密钥的哈希虽然不可反推，但它属于凭据材料，
 * 没有任何理由出现在普通接口的响应里。所有返回 memo 的接口都走这个列集合，
 * 避免以后新增字段时又从 `select()` 里漏出去。
 */
export const memoResponseColumns = {
  id: memos.id,
  userId: memos.userId,
  title: memos.title,
  content: memos.content,
  color: memos.color,
  pinned: memos.pinned,
  createdAt: memos.createdAt,
  updatedAt: memos.updatedAt,
};

/** 2FA / TOTP 账户表 */
export const totpAccounts = pgTable(
  "totp_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    issuer: text("issuer").notNull().default(""),
    accountName: text("account_name").notNull().default(""),
    secret: text("secret").notNull(),
    algorithm: text("algorithm").notNull().default("SHA1"),
    digits: integer("digits").notNull().default(6),
    period: integer("period").notNull().default(30),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("totp_user_idx").on(t.userId)],
);

/**
 * OAuth 授权码。
 *
 * 主键存的是授权码的 SHA-256 哈希，明文只在重定向那一刻出现一次。
 * 一次性使用：consumed_at 一旦写入，同一个码就不能再换令牌。
 */
export const oauthCodes = pgTable(
  "oauth_codes",
  {
    codeHash: text("code_hash").primaryKey(),
    clientId: text("client_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri").notNull(),
    scope: text("scope").notNull().default(""),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method")
      .notNull()
      .default("S256"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("oauth_codes_user_idx").on(t.userId)],
);

/** OAuth 访问令牌。同样只存哈希。 */
export const oauthAccessTokens = pgTable(
  "oauth_access_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    clientId: text("client_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: text("scope").notNull().default(""),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("oauth_tokens_user_idx").on(t.userId)],
);

export type UserRow = typeof users.$inferSelect;
export type MemoRow = typeof memos.$inferSelect;
export type TotpAccountRow = typeof totpAccounts.$inferSelect;
export type OAuthCodeRow = typeof oauthCodes.$inferSelect;
export type OAuthAccessTokenRow = typeof oauthAccessTokens.$inferSelect;
