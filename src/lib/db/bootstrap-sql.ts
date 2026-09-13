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
  CONSTRAINT users_email_unique UNIQUE (email)
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
`;
