# MemoVault 便签（Windows 客户端）

把 MemoVault 里的备忘录变成桌面上一张半透明的小卡片：常驻置顶、可拖动、按设定间隔自动同步。
只读，凭**账号 API 密钥**访问，不需要在客户端里存密码。

## 环境要求

- Windows 10 / 11
- [.NET 8 桌面运行时](https://dotnet.microsoft.com/download/dotnet/8.0)（Desktop Runtime，不是 ASP.NET）
  - 想完全免安装依赖，用下面的 self-contained 发布方式

## 构建

```powershell
# 开发运行
dotnet run

# 发布（体积小，依赖系统已装的 .NET 8 桌面运行时）
dotnet publish -c Release -r win-x64 --self-contained false -o dist

# 发布（单文件、免安装运行时，约 150 MB）
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o dist-standalone
```

产物在 `dist\`，双击 `MemoVaultNote.exe` 即可。

## 首次使用

1. 打开网页端 MemoVault → 侧栏 **API 密钥** → 生成，复制 `mv_` 开头的那串（只显示一次）
2. 右键卡片或用右上角齿轮打开设置：
   - **服务器地址**：`https://vault-indol-xi.vercel.app`（自己部署的填自己的，不要带 `/api`）
   - **API 密钥**：粘贴上一步的密钥
   - **刷新间隔**：多少分钟拉一次，1–1440
3. 点「测试连接」确认能读到条数，再保存

## 功能

- 无边框半透明卡片，圆角、阴影，可拖动到任意位置（位置会记住）
- 窗口置顶（默认开，右键菜单可切）
- 右上角：立即刷新 / 设置 / 关闭
- 底部：颜色标签、最后同步时间、`1/n` 切换多条备忘录
- 右键菜单：刷新、设置、置顶、退出
- 开机自启（写 `HKCU\...\Run`，不需要管理员）
- 卡片不透明度 50%–100%（只影响背景，文字始终不透明）

## 配置与安全

- 配置存放在 `%APPDATA%\MemoVaultNote\config.json`
- API 密钥用 **Windows DPAPI**（当前用户）加密后保存，明文只在内存里；
  文件拷到别的机器 / 别的用户下解不开
- 密钥是**只读**的：客户端不会写备忘录，也拿不到 2FA 数据
- 撤销或轮换密钥后，客户端会在下一次刷新时提示「API 密钥无效或已被撤销」

## 实现说明

- .NET 8 + WPF，无第三方 UI 库；唯一依赖是 `System.Security.Cryptography.ProtectedData`
- 轮询用 `DispatcherTimer`，间隔改完立即生效，不用重启
- HTTP 只调 `GET /api/memos?limit=100`，带 `Authorization: Bearer <key>`
- 断网 / 服务端报错时保留上一次内容，只在卡片底部显示一行错误，不会清空
