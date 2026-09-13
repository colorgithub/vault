# MemoVault · 备忘录 & 2FA 验证器

一个现代化的网页备忘录应用，同时内置 TOTP 两步验证器。使用 **Next.js 15 + React 19 + Tailwind CSS 4 + Drizzle ORM + PostgreSQL** 构建，可直接一键部署到 **Vercel**。

![tech](https://img.shields.io/badge/Next.js-15-black) ![tech](https://img.shields.io/badge/React-19-blue) ![tech](https://img.shields.io/badge/Tailwind-4-38bdf8) ![tech](https://img.shields.io/badge/Postgres-required-336791)

---

## ✨ 功能

### 1. 备忘录：新建 / 保存 / 修改
- 新建、编辑、删除、置顶，7 种颜色标签
- **输入即自动保存**（700ms 防抖），右上角实时显示「保存中 / 已自动保存」
- 全文搜索（标题 + 内容）
- 支持 **Markdown 预览**，渲染结果经 DOMPurify 消毒，防 XSS
- 切换标签页 / 关闭页面时自动补存未落盘的改动
- 移动端两栏自适应：列表 ⇄ 编辑页

### 2. 2FA 验证码：实时显示 + 扫码新建
- **纯 Web Crypto 实现的 TOTP**（RFC 6238），代码在浏览器本地计算，服务端不参与算码
- 每秒刷新，环形/条形进度条 + 剩余秒数，最后 5 秒变红
- 点击验证码一键复制
- **二维码扫描**：
  - 摄像头实时识别（`jsQR`）
  - 也支持**上传二维码截图**识别（桌面端无摄像头也能用）
  - 支持 `otpauth://totp/...` 标准链接
  - **支持 Google Authenticator 的 `otpauth-migration://` 批量导出码**，一次导入多个账户
- 手动录入，带高级设置（算法 SHA1/SHA256/SHA512、位数、周期），可随机生成密钥
- 显示等价的 `otpauth://` 链接，方便迁移到其它验证器

### 3. 账号体系
- 邮箱 + 密码注册 / 登录 / 登出
- 密码使用 **PBKDF2-SHA256（210,000 次迭代 + 随机盐）** 哈希
- 会话使用 **JWT（HS256）+ httpOnly Cookie**，有效期 7 天
- **多账号数据严格隔离**：所有数据库查询都带 `user_id` 条件，跨账号访问一律 404
- 登录接口对不存在的邮箱也执行一次哈希运算，避免通过响应时间枚举账号

### 4. 其它
- 深色 / 浅色主题，跟随系统并可手动切换（无闪白）
- 一键导出 JSON 备份
- Toast 通知、空状态、加载态、响应式布局

---

## 🚀 部署到 Vercel

### 第一步：准备数据库

Vercel 本身不提供数据库，需要一个 Postgres。推荐 **Neon**（免费额度充足，与 Vercel 集成最好）：

1. 打开 [Vercel Marketplace → Neon](https://vercel.com/marketplace/neon)，或直接去 [neon.tech](https://neon.tech) 注册
2. 创建一个项目，复制 **Connection string**（形如 `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`）

> 其它可选：Supabase、Vercel Postgres、Railway、自建 Postgres 均可，只要有 `DATABASE_URL`。

### 第二步：部署代码

**方式 A：通过 GitHub（推荐）**

1. 把本项目推送到 GitHub 仓库
2. 在 [vercel.com/new](https://vercel.com/new) 导入该仓库
3. Framework Preset 会自动识别为 **Next.js**，无需改动构建命令
4. 在 **Environment Variables** 里添加下面两个变量：

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | 上一步拿到的 Postgres 连接串 |
| `AUTH_SECRET` | ✅ | 会话签名密钥，长度 ≥ 16 的随机字符串 |
| `NEXT_PUBLIC_APP_NAME` | ⬜ | 站点名称，默认 `MemoVault` |

生成一个安全的 `AUTH_SECRET`：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

5. 点击 **Deploy**，等待完成即可。

**方式 B：Vercel CLI**

```bash
npm i -g vercel
vercel                    # 首次部署，按提示关联项目
vercel env add DATABASE_URL
vercel env add AUTH_SECRET
vercel --prod
```

### 第三步：建表

**不需要手动建表。** 应用第一次收到 API 请求时会自动执行幂等的 `CREATE TABLE IF NOT EXISTS`，表结构即刻就绪。

如果你想用正规的迁移流程，也可以在本地对云端数据库执行：

```bash
DATABASE_URL="你的连接串" npm run db:push
```

---

## 🧑‍💻 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local
#   然后编辑 .env.local，填入 DATABASE_URL 与 AUTH_SECRET

# 3. 启动开发服务器
npm run dev
# 打开 http://localhost:3000
```

没有现成的 Postgres？用 Docker 起一个：

```bash
docker run -d --name memovault-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=memovault \
  -p 5432:5432 postgres:16
```

对应的连接串：

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/memovault"
```

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run db:push` | 用 Drizzle Kit 同步表结构（可选） |
| `npm run db:generate` | 生成迁移 SQL（可选） |

---

## 🔌 API 一览

所有接口都返回 JSON，未登录时返回 `401`。

### 认证 `/api/auth`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/register` | 注册，body：`{ name, email, password }` |
| `POST` | `/api/auth/login` | 登录，body：`{ email, password }` |
| `POST` | `/api/auth/logout` | 登出 |
| `GET` | `/api/auth/me` | 当前用户，未登录返回 `{ user: null }` |

### 备忘录 `/api/memos`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/memos?q=关键词` | 列出（标题降序 / 置顶优先） |
| `POST` | `/api/memos` | 新建 `{ title, content, color, pinned }` |
| `GET` | `/api/memos/:id` | 单条详情 |
| `PATCH` | `/api/memos/:id` | 局部更新（字段都可选） |
| `DELETE` | `/api/memos/:id` | 删除 |

### 2FA `/api/totp`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/totp` | 列出全部账户（含密钥，供前端本地算码） |
| `POST` | `/api/totp` | 见下方三种请求体 |
| `PATCH` | `/api/totp/:id` | 修改名称 / 备注 / 算法等 |
| `DELETE` | `/api/totp/:id` | 删除 |

`POST /api/totp` 支持三种请求体：

```jsonc
// 1. 手动录入
{ "issuer": "GitHub", "accountName": "me@example.com",
  "secret": "JBSWY3DPEHPK3PXP", "algorithm": "SHA1", "digits": 6, "period": 30 }

// 2. 扫码后传原始链接（支持 otpauth-migration 批量）
{ "uri": "otpauth://totp/GitHub:me@example.com?secret=...&issuer=GitHub" }

// 3. 直接批量
{ "accounts": [ { "issuer": "A", "secret": "..." }, { "issuer": "B", "secret": "..." } ] }
```

---

## 🗂 项目结构

```
src/
├── app/
│   ├── layout.tsx              # 根布局 + 主题脚本（防闪白）
│   ├── page.tsx                # 落地页
│   ├── login/ register/        # 登录 / 注册
│   ├── vault/                  # 主应用（需登录）
│   ├── globals.css             # Tailwind v4 主题与组件样式
│   └── api/
│       ├── auth/{register,login,logout,me}/route.ts
│       ├── memos/route.ts  memos/[id]/route.ts
│       └── totp/route.ts   totp/[id]/route.ts
├── components/
│   ├── VaultApp.tsx            # 主壳：侧栏 + 路由切换 + 数据加载
│   ├── MemoWorkspace.tsx       # 备忘录列表 + 编辑器（自动保存）
│   ├── TotpWorkspace.tsx       # 验证器网格
│   ├── TotpCard.tsx            # 单张验证码卡片（实时刷新）
│   ├── AddAccountDialog.tsx    # 添加账户（扫码 / 手动）
│   ├── EditAccountDialog.tsx   # 编辑账户
│   ├── QrScanner.tsx           # 摄像头 / 图片二维码识别
│   ├── AuthForm.tsx AuthShell.tsx Modal.tsx Toast.tsx Icons.tsx
└── lib/
    ├── auth.ts                 # PBKDF2 哈希 + JWT 会话
    ├── totp.ts                 # TOTP / Base32 / otpauth URI / 迁移码解析
    ├── api.ts                  # 路由包装、统一错误处理
    ├── client.ts               # fetch 封装、hooks、工具函数
    ├── constants.ts            # 颜色与长度限制
    ├── types.ts
    └── db/
        ├── schema.ts           # Drizzle 表定义
        ├── bootstrap-sql.ts    # 幂等建表语句
        └── index.ts            # 连接池 + ensureSchema()
```

---

## 🔐 安全说明

- 所有数据查询都强制带 `user_id`，跨账号读写一律 404
- 密码从不明文存储，使用 PBKDF2-SHA256 + 每用户独立随机盐
- 会话 Cookie 为 `httpOnly` + `sameSite=lax`，生产环境自动带 `secure`
- Markdown 预览经 DOMPurify 消毒
- 响应头附带 `X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff` 等
- 摄像头权限通过 `Permissions-Policy` 限定为同源

> ⚠️ **TOTP 密钥以可逆形式存储**：因为需要在浏览器本地实时计算验证码，服务端必须能把密钥下发给已登录的用户。这是所有自建验证器的共同取舍 —— 请务必使用可信的数据库服务商，并保管好 `DATABASE_URL`。

---

## 📄 License

MIT
