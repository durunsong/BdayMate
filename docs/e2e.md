# 认证集成与浏览器验收

## 前置条件

安装项目已有依赖并完成 Prisma 生成与迁移；本地环境需要 DATABASE_URL、BETTER_AUTH_SECRET 和 CRON_SECRET。连接凭据只在进程内读取，不写进测试代码、截图或日志。测试使用真实数据库，仅创建随机 test-…@example.test 账户；Better Auth 自行产生账户 ID，清理时记录并核对该 ID 与精确邮箱。

Playwright 默认使用其 Chromium。若本机已有 Google Chrome，可运行：

    PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e

没有任何可用浏览器时，应先准备标准 Playwright 浏览器运行环境；本测试不会自动安装依赖或浏览器。

## 命令

    pnpm exec vitest run tests/integration/auth.test.ts
    pnpm exec playwright test --list
    pnpm test:e2e

认证集成测试在父进程启动临时 SMTP 和邮件捕获 HTTP，给独立 Vitest 子进程注入专属环境，再执行 12 个真实认证用例。外层报告为 1 个隔离执行测试；内部用例失败会导致整体失败。未在并发测试进程中改写全局 SMTP 环境，没有认证、数据库或邮件 mocks。

## 浏览器链路

Playwright 自动启动 scripts/e2e-server.ts：

- Next dev 仅监听 127.0.0.1:3100，认证与公开链接使用同一 origin。
- 真实 smtp-server 使用临时端口，关闭本地测试 SMTP 的 AUTH/STARTTLS；生产邮件配置不被修改。
- 内存邮件捕获仅监听 127.0.0.1:3101，GET /messages?recipient=… 需要专用非生产 X-Test-Mail-Secret；只接受 test-…@example.test 收件人。
- 邮件链接与令牌只驻留内存，不输出到服务日志；关闭 Playwright trace/video，避免记录真实会话 cookie 与验证链接。
- 启动器退出时关闭它自己启动的 Next、SMTP 和捕获服务，不复用已有 Web 服务器。

覆盖 3 个浏览器流程：

1. 匿名访问受保护页面重定向登录；导出与两个 Cron 接口拒绝未授权请求。
2. 页面注册 → SMTP 中取得验证链接 → 验证 → 重新密码登录 → Dashboard → 添加当天（Asia/Shanghai）的联系人 → 联系人独立提醒设为当天 00:00 → 生成队列 → 鉴权 Cron 投递 → 页面邮件记录显示发送成功 → CSV 导入/导出与公式注入中和 → 390px 移动导航和溢出检查。
3. 页面申请密码重置 → 打开 SMTP 链接 → 更新密码 → 旧密码失败 → 新密码成功。

所有 Cron 测试始终在 POST JSON 或 GET 查询参数中携带当前测试账户的精确 userId，不调用全账户生成/投递。GET 覆盖 Vercel 调度，POST 回归保持兼容；重复消费不重复发送，响应必须禁止缓存。真实联系人邮箱设置为另一个不可接受的地址，核对收到提醒的始终是账户本人。

## 清理与限制

每个测试记录自己创建的账户 ID；只删除 ID 与精确随机邮箱同时匹配的账户。若注册在保存后失败，仅用该次测试的唯一邮箱找回 ID。认证验证记录先按该账户 ID 读取对应 identifier，再按 identifier 与账户 ID 双条件删除，关联业务数据由数据库约束级联清理。不会按 test- 前缀批量清理，也不删除其他测试或用户数据。

依赖真实数据库的可用性、已完成迁移与本地浏览器。首轮编译和远程数据库唤醒可能增加耗时。测试通过证明本地真实 SMTP 协议和应用全链路，不代表尚未配置的外部 SMTP 服务已投递至公网邮箱。

补充认证回归：注销账户的空密码/缺失密码/错误密码被服务端拒绝；正确当前密码删除账户，并验证所属联系人、礼物、会话等级联清理。
