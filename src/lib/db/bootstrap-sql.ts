/**
 * 幂等建表语句。
 *
 * 目的：只要在 Vercel 上配置了 DATABASE_URL，首次访问就会自动创建所需表结构，
 * 不需要额外跑迁移命令。想用正规迁移流程的话也可以执行 `npm run db:push`。
 *
 * 注意：这里的约束名 / 索引名刻意与 Drizzle schema 生成的保持一致，
 * 这样「自动建表」与「db:push」两条路径不会互相冲突（push 会显示 No changes）。
 */
export const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  name          text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  api_key_hash       text,
  api_key_created_at timestamptz,
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_api_key_hash_unique UNIQUE (api_key_hash)
);

CREATE TABLE IF NOT EXISTS memos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  title      text NOT NULL DEFAULT '',
  content    text NOT NULL DEFAULT '',
  color      text NOT NULL DEFAULT 'slate',
  pinned     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memos_user_id_users_id_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS totp_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  issuer       text NOT NULL DEFAULT '',
  account_name text NOT NULL DEFAULT '',
  secret       text NOT NULL,
  algorithm    text NOT NULL DEFAULT 'SHA1',
  digits       integer NOT NULL DEFAULT 6,
  period       integer NOT NULL DEFAULT 30,
  note         text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT totp_accounts_user_id_users_id_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS memos_user_updated_idx
  ON memos USING btree (user_id, updated_at);

CREATE INDEX IF NOT EXISTS totp_user_idx
  ON totp_accounts USING btree (user_id);

-- ---------------------------------------------------------------------------
-- 账号级 API 密钥列（后加的字段）
--
-- CREATE TABLE IF NOT EXISTS 对已存在的表不会补列，所以升级部署必须显式 ADD COLUMN。
-- 这里用 IF NOT EXISTS 保证重复执行幂等；唯一约束没有 IF NOT EXISTS 语法，
-- 用 DO 块查 pg_constraint 再决定是否添加。
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key_created_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_api_key_hash_unique'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_api_key_hash_unique UNIQUE (api_key_hash);
  END IF;
END $$;

-- 早期版本曾把密钥挂在每条备忘录上（share_key_hash），已改为账号级，
-- 这里清掉遗留列。DROP COLUMN 会一并带走其上的唯一约束。
ALTER TABLE memos DROP COLUMN IF EXISTS share_key_created_at;
ALTER TABLE memos DROP COLUMN IF EXISTS share_key_hash;

-- OAuth 授权码：主键为授权码的 SHA-256 哈希，一次性使用
CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash            text PRIMARY KEY,
  client_id            text NOT NULL,
  user_id              uuid NOT NULL,
  redirect_uri         text NOT NULL,
  scope                text NOT NULL DEFAULT '',
  code_challenge       text NOT NULL,
  code_challenge_method text NOT NULL DEFAULT 'S256',
  expires_at           timestamptz NOT NULL,
  consumed_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_codes_user_id_users_id_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS oauth_codes_user_idx
  ON oauth_codes USING btree (user_id);

-- OAuth 访问令牌：同样只存哈希
CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  token_hash  text PRIMARY KEY,
  client_id   text NOT NULL,
  user_id     uuid NOT NULL,
  scope       text NOT NULL DEFAULT '',
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_access_tokens_user_id_users_id_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS oauth_tokens_user_idx
  ON oauth_access_tokens USING btree (user_id);
`;
