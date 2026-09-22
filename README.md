# MemoVault · 备忘录 & 2FA 验证器

一个现代化的网页备忘录应用，同时内置 TOTP 两步验证器。使用 **Next.js 15 + React 19 + Tailwind CSS 4 + Drizzle ORM + PostgreSQL** 构建，可直接一键部署到 **Vercel**。

![tech](https://img.shields.io/badge/Next.js-15-black) ![tech](https://img.shields.io/badge/React-19-blue) ![tech](https://img.shields.io/badge/Tailwind-4-38bdf8) ![tech](https://img.shields.io/badge/Postgres-required-336791)

---

## ✨ 功能

### 1. 备忘录：新建 / 保存 / 修改
- 新建、编辑、删除、置顶，7 种颜色标签
- **输入即自动保存**（700ms 防抖），右上角实时显示「保存中 / 已保存 / 保存失败」
- 保存按备忘录串行化：同一 memo 同时只有一条写入在途，内容变化会自动合并重发，
  不会出现旧响应盖掉新内容，也不会漏掉「改回原值」这类编辑
- 切换备忘录 / 切换标签页 / 关闭页面时都会补存未落盘的改动
- 全文搜索（标题 + 内容）
- 支持 **Markdown 预览**，渲染结果经 DOMPurify 消毒，防 XSS
- 列表分页：超过单页上限时显示「加载更多」，导出备份会取全量数据
- 移动端两栏自适应：列表 ⇄ 编辑页

### 2. 2FA 验证码：实时显示 + 图片识别新建
- **纯 Web Crypto 实现的 TOTP**（RFC 6238），代码在浏览器本地计算，服务端不参与算码
- 每秒刷新，极细进度条 + 剩余秒数，最后 5 秒转为红色
- 点击验证码一键复制
- **二维码识别（不使用摄像头）**，三种方式任选：
  - **粘贴图片**：按 `Ctrl/⌘ + V` 直接粘贴截图，或点「粘贴图片」从系统剪贴板读取
  - **截取屏幕**：通过 `getDisplayMedia` 共享屏幕/窗口/标签页，实时扫描屏幕上的二维码
  - **选择 / 拖拽图片**：本地图片文件或直接拖进虚线框
  - 支持 `otpauth://totp/...` 标准链接，也接受直接粘贴链接文本
  - **支持 Google Authenticator 的 `otpauth-migration://` 批量导出码**，一次导入多个账户
  - 迁移码里 base64 的 `+` 无论是否做了百分号编码都能正确解析
  - 识别失败会给出具体原因（而不是笼统的「二维码无效」），且不会抛异常中断界面
- 手动录入，带高级设置（算法 SHA1/SHA256/SHA512、位数 4-10、周期 5-300），可随机生成密钥
- 显示等价的 `otpauth://` 链接，方便迁移到其它验证器
- 在非安全上下文（局域网 http://）下会明确提示「需要 HTTPS 或 localhost」，而不是静默失效

### 3. 账号体系
- 邮箱 + 密码注册 / 登录 / 登出
- 密码使用 **PBKDF2-SHA256（210,000 次迭代 + 随机盐）** 哈希
- 会话使用 **JWT（HS256）+ httpOnly Cookie**，有效期 7 天
- **多账号数据严格隔离**：所有数据库查询都带 `user_id` 条件，跨账号访问一律 404
- 登录接口对不存在的邮箱也执行一次哈希运算，避免通过响应时间枚举账号
- 登出与读取当前用户不依赖数据库，数据库不可用时依然能正常登出
- 服务端错误只返回通用文案，不会把驱动的原始报错（可能含数据库连接串）回显给客户端

### 4. 界面与其它
- **克制的单色设计**：无渐变、无光晕、无毛玻璃，只有一个强调色用于焦点与选中态
- 深色 / 浅色主题，跟随系统并可手动切换（无闪白）
- 一键导出 JSON 备份
- Toast 通知、空状态、加载态、响应式布局

### 5. 兼容性：低版本 Android WebView
- 目标 **Chrome / Android System WebView 61+**（硬下限 49，见下文）
- Tailwind v4 输出的 `@layer` / `oklch()` / `:where()` / `dvh` / `translate` 全部在
  构建期降级，旧 WebView 上不会出现「完全没样式」
- `flex gap` 在 `@supports not (gap: 0px)` 下用子元素 margin 回退（Chromium < 84）
- 运行时 polyfill 以 ES5 内联脚本注入，早于所有 bundle 执行
- 按能力降级：不支持截屏 / 读剪贴板的浏览器会隐藏对应入口并给出替代方式
- 低于硬下限时显示可读的升级提示，而不是白屏

---

## 🚀 部署到 Vercel

### 第一步：在 Vercel 里直接创建数据库

不需要离开 Vercel，也不需要单独注册数据库服务：

1. 先在 [vercel.com/new](https://vercel.com/new) 导入本仓库（Framework Preset 会自动识别为 **Next.js**）
2. 进入项目 → 顶部 **Storage** 标签 → **Create Database** → 选择 **Neon**（Postgres）
3. 选好区域和套餐（免费额度足够），点创建
4. 创建完会自动提示 **Connect Project**，选中你刚部署的项目，并勾选
   **Production / Preview / Development** 三个环境
5. 点 **Connect**

连接完成后，Vercel **会自动往项目里注入 `DATABASE_URL`**，你不需要手动复制连接串。

> 💡 **多数据库注意**：如果你在同一个项目里挂了多个数据库，Vercel 会让你设一个前缀
> （例如 `PRIMARY_`），变量名就变成 `PRIMARY_DATABASE_URL`。
> 本项目做了兜底解析，只要以 `_DATABASE_URL` 结尾就能识别，不用改代码。

### 第二步：配置会话密钥

项目 → **Settings → Environment Variables**，添加：

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `AUTH_SECRET` | ✅ | 会话签名密钥，长度 ≥ 16 的随机字符串。**必须手动添加** |
| `DATABASE_URL` | ⬜ | 上一步由 Vercel 自动注入，通常不用管 |
| `NEXT_PUBLIC_APP_NAME` | ⬜ | 站点名称，默认 `MemoVault` |

生成一个安全的 `AUTH_SECRET`：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 第三步：部署 & 自检

点 **Deploy** 即可。<mark>不需要手动建表</mark>——应用第一次收到请求时会自动执行幂等的 `CREATE TABLE IF NOT EXISTS`。

部署完成后访问 **`/api/health`** 可以确认数据库是否连通，例如：

```json
{ "status": "ok",
  "database": { "connected": true, "envVar": "DATABASE_URL", "latencyMs": 42 } }
```

如果没连上，它会告诉你当前环境里存在哪些数据库相关变量，方便排查（只会输出变量名，不会泄露连接串内容）。

---

## 🔌 数据库连接串是怎么找的

在 Vercel 上「创建 / 连接数据库」有好几种方式，不同集成注入的变量名并不一样。为了不用管这些差异，程序会按下面的顺序自动查找，命中任意一个即可：

| 顺序 | 变量名 | 来源 |
| --- | --- | --- |
| 1 | `DATABASE_URL` | Vercel Marketplace 的 Neon 集成（默认） |
| 2 | `POSTGRES_URL` | 老版 Vercel Postgres 模板 |
| 3 | `POSTGRES_PRISMA_URL` | Prisma Postgres 集成 |
| 4 | `DATABASE_URL_UNPOOLED` | Neon 直连串（连接池不可用时的兜底） |
| 5 | `POSTGRES_URL_NON_POOLING` | 同上，Vercel Postgres 命名 |
| 6 | `NEON_DATABASE_URL` | Neon 手动接入 |
| 7 | 任意 `*_DATABASE_URL` | 带自定义前缀的集成，如 `PRIMARY_DATABASE_URL` |
| 8 | `PGHOST` + `PGUSER` + `PGPASSWORD` + `PGDATABASE` + `PGPORT` | 零散变量拼装 |

连接池配置为 `max: 1` + `prepare: false`，兼容 Neon / Supabase 的 PgBouncer 事务池模式，也适配 Vercel serverless 的短生命周期。

### 手动连接（可选）

如果你想自己指定数据库，在 **Settings → Environment Variables** 里直接填 `DATABASE_URL` 即可，它的优先级最高：

```bash
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
```

也可以用正规迁移流程替代自动建表：

```bash
DATABASE_URL="你的连接串" npm run db:push
```

> 自动建表与 `db:push` 的约束名、索引名已对齐，两条路径不会互相冲突（push 会显示 `No changes detected`）。

### 用 Vercel CLI 部署（可选）

```bash
npm i -g vercel
vercel                    # 首次部署，按提示关联项目
vercel env add AUTH_SECRET
vercel --prod
```

数据库仍然推荐在 Vercel 网页控制台里创建并连接，这样变量会自动注入。

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

### 自检 `/api/health`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 数据库连通性与所用环境变量名，部署后第一件事就访问它 |

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
| `GET` | `/api/memos?q=关键词&limit=300&offset=0` | 分页列出（置顶优先 / 更新时间降序） |
| `POST` | `/api/memos` | 新建 `{ title, content, color, pinned }` |
| `GET` | `/api/memos/:id` | 单条详情 |
| `PATCH` | `/api/memos/:id` | 局部更新（字段都可选） |
| `DELETE` | `/api/memos/:id` | 删除 |

`GET /api/memos` 返回分页信息，前端据此决定是否显示「加载更多」：

```jsonc
{ "memos": [ /* ... */ ], "total": 812, "limit": 300, "offset": 0, "hasMore": true }
```

`limit` 上限 500，默认 300。`POST` 与 `PATCH` 都不允许把标题和内容同时清空。

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

// 2. 图片识别后传原始链接（支持 otpauth-migration 批量）
{ "uri": "otpauth://totp/GitHub:me@example.com?secret=...&issuer=GitHub" }

// 3. 直接批量
{ "accounts": [ { "issuer": "A", "secret": "..." }, { "issuer": "B", "secret": "..." } ] }
```

---

## 🗂 项目结构

```
postcss.config.mjs              # PostCSS 降级链（低版本 WebView 适配）
postcss-android-webview.cjs     # 自定义插件：:where/:is、dvh、translate、flex gap
next.config.ts                  # 安全响应头
drizzle.config.ts               # Drizzle Kit 配置
src/
├── app/
│   ├── layout.tsx              # 根布局 + polyfill / 主题脚本（防闪白）
│   ├── page.tsx                # 落地页
│   ├── login/ register/        # 登录 / 注册
│   ├── vault/                  # 主应用（需登录）
│   ├── globals.css             # Tailwind v4 主题与组件样式
│   └── api/
│       ├── health/route.ts     # 部署自检
│       ├── auth/{register,login,logout,me}/route.ts
│       ├── memos/route.ts  memos/[id]/route.ts
│       └── totp/route.ts   totp/[id]/route.ts
├── components/
│   ├── VaultApp.tsx            # 主壳：侧栏 + 路由切换 + 数据加载
│   ├── MemoWorkspace.tsx       # 备忘录列表 + 编辑器（自动保存）
│   ├── TotpWorkspace.tsx       # 验证器网格
│   ├── TotpCard.tsx            # 单张验证码卡片（实时刷新）
│   ├── AddAccountDialog.tsx    # 添加账户（图片识别 / 手动）
│   ├── EditAccountDialog.tsx   # 编辑账户
│   ├── QrScanner.tsx           # 二维码识别（粘贴 / 屏幕捕获 / 图片）
│   ├── NumberField.tsx         # 数字输入（允许逐字符键入，失焦才回退）
│   ├── PolyfillScript.tsx      # 内联注入 ES5 polyfill（早于所有 bundle）
│   ├── UnsupportedBrowserNotice.tsx  # 低于兼容下限时的提示
│   ├── AuthForm.tsx AuthShell.tsx Modal.tsx Toast.tsx Icons.tsx
└── lib/
    ├── auth.ts                 # PBKDF2 哈希 + JWT 会话
    ├── totp.ts                 # TOTP / Base32 / otpauth URI / 迁移码解析
    ├── api.ts                  # 路由包装、统一错误处理、请求体校验
    ├── client.ts               # fetch 封装、hooks、能力探测、工具函数
    ├── polyfills.ts            # 旧 WebView 运行时 polyfill（ES5）
    ├── constants.ts            # 颜色、长度限制与分页参数
    ├── types.ts
    └── db/
        ├── schema.ts           # Drizzle 表定义
        ├── bootstrap-sql.ts    # 幂等建表语句
        └── index.ts            # 连接池 + ensureSchema()
```

---

## 📱 低版本 Android WebView 适配

### 支持范围

| 项目 | 版本 |
| --- | --- |
| 目标 | Chrome / Android System WebView **61+** |
| 硬下限 | **49**（低于此版本 otpauth 解析与 TOTP 无法工作） |
| browserslist | `chrome >= 61`、`and_chr >= 61`、`android >= 5` |

硬下限由 API 决定：`URLSearchParams`（otpauth 解析）需要 Chrome 49，
`crypto.subtle`（算码）需要 37/41，`requestAnimationFrame` 需要 22。

### 设备对照

| Android | 原生 WebView | 是否达标 |
| --- | --- | --- |
| 5.0 – 8.0 | Chrome 37 – 58 | 需升级 WebView |
| 9.0 | Chrome 66 | ✅ |
| 10+ | Chrome 74+ | ✅ |

Android 5.0 起 WebView 可通过 Play 商店独立更新；停留在系统版本的国产 ROM 是主要目标场景。

### 构建期降级（`postcss.config.mjs` + `postcss-android-webview.cjs`）

| 特性 | 需要 | 不处理会怎样 | 处理方式 |
| --- | --- | --- | --- |
| `@layer` | Chrome 99 | **整个块被丢弃 → 页面完全没样式** | 展开为普通规则 |
| `oklch()` | Chrome 111 | 颜色声明整条失效 | 转为 `rgb()` |
| `:where()` / `:is()` | Chrome 88 | 选择器非法 → 整条规则丢弃 | 展开为平铺选择器 |
| `dvh` 单位 | Chrome 108 | 全屏面板高度塌陷 | 补 `vh` 回退声明 |
| `translate:` 属性 | Chrome 104 | 居中 / 偏移丢失 | 改写为 `transform` |
| `flex gap` | Chrome 84 | flex 间距全部塌掉 | `@supports not (gap:0px)` 下用 margin 回退 |

厂商前缀由 `autoprefixer` 按 browserslist 自动补齐。

### 运行时 polyfill

`src/lib/polyfills.ts` 以 **ES5 内联脚本**注入 `<head>`，早于所有 bundle：

- `globalThis`(71)、`Object.fromEntries`(73)、`Promise.allSettled`(76)
- `Promise.any`(85)、`Array.prototype.at`(92)、`flat`/`flatMap`(69)
- `String.prototype.replaceAll`(85)、`Object.hasOwn`(93)、`findLast`/`findLastIndex`(97)

脚本本身必须是 ES5 —— 否则旧引擎连 polyfill 都解析不了。

另外，应用代码已不使用 `Promise.allSettled`（改用 `settleAll`，见 `src/lib/client.ts`），
避免为一个 API 把兼容下限从 61 抬到 76。

### 能力降级

`src/lib/client.ts` 的 `getClientCaps()` 读取启动时写入的能力标记：

- 无 `getDisplayMedia`（Chrome 72）→ 隐藏「截取屏幕」
- 无 `clipboard.read`（Chrome 76）→ 隐藏「粘贴图片」，保留 Ctrl+V 与选图
- 无 `crypto.subtle`（非 HTTPS）→ 验证码卡片提示「需要 HTTPS 或 localhost」
- 低于硬下限 → `UnsupportedBrowserNotice` 显示升级提示

### 本地验证

```bash
npm run build
# 检查构建产物里是否还有现代特性
node -e "const fs=require('fs');const d='.next/static/css';const f=fs.readdirSync(d)[0];const c=fs.readFileSync(d+'/'+f,'utf8');for(const p of ['@layer','oklch(',':where(',':is(','translate:']){console.log(p,(c.match(new RegExp(p.replace(/[()]/g,'\\\\$&'),'g'))||[]).length)}"
```

预期输出全部为 `0`（`translate:` 与 `:where(`/`:is(`/`@layer`/`oklch(`）。

---

## 🔐 安全说明

- 所有数据查询都强制带 `user_id`，跨账号读写一律 404
- 密码从不明文存储，使用 PBKDF2-SHA256 + 每用户独立随机盐
- 会话 Cookie 为 `httpOnly` + `sameSite=lax`，生产环境自动带 `secure`
- Markdown 预览经 DOMPurify 消毒
- 响应头附带 `X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff` 等
- **完全不请求摄像头权限**：响应头里 `camera=()` 直接禁用，代码中也没有任何 `getUserMedia` 调用；屏幕捕获用 `display-capture=(self)` 限定同源

> ⚠️ **TOTP 密钥以可逆形式存储**：因为需要在浏览器本地实时计算验证码，服务端必须能把密钥下发给已登录的用户。这是所有自建验证器的共同取舍 —— 请务必使用可信的数据库服务商，并保管好 `DATABASE_URL`。

---

## 📄 License

MIT
