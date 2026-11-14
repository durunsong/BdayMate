# Vercel 部署

使用 Vercel 的 Next.js 部署，数据库仍为 Neon。仓库已提供 Node.js 22、固定 pnpm 锁文件安装、Prisma Client 生成、Singapore sin1 区域与 Fluid Compute 配置。区域与本次 Neon 数据库一致。

## 1. 导入仓库

在 Vercel 新建项目，导入 GitHub 的 durunsong/BdayMate：

| 设置             | 值                                              |
| ---------------- | ----------------------------------------------- |
| Framework Preset | Next.js                                         |
| Root Directory   | 仓库根目录，不填写本机的 personal_code/BdayMate |
| Node.js          | 22.x，由 package.json 指定                      |
| Install Command  | corepack pnpm install --frozen-lockfile         |
| Build Command    | pnpm build，包含 prisma generate                |
| Output Directory | Next.js 默认值，不改为 out 或 .next/standalone  |
| Function Region  | Singapore sin1                                  |

Production Branch 选择 main。完整应用和定时工作流一起推送到 main；feat/full-birthday-platform 保留同一版本。Preview 使用独立配置，GitHub 定时器始终只调用配置的稳定生产域名。

## 2. 环境变量

在 Settings → Environment Variables 中添加以下变量，至少选择 Production。真实值从本机私有 .env 或自己的秘密管理器填写，不能放入 GitHub 代码、vercel.json 或截图。

| 变量                                          | Production 的值                              |
| --------------------------------------------- | -------------------------------------------- |
| DATABASE_URL                                  | 已提供的 Neon pooled 连接，保留 SSL 参数     |
| DIRECT_URL                                    | 同一数据库的 direct 连接，用于受控迁移       |
| BETTER_AUTH_SECRET                            | 已生成的随机秘密或独立生产秘密，至少 32 字符 |
| CRON_SECRET                                   | 至少 32 字符独立随机值；不能带换行或前后空格 |
| BETTER_AUTH_URL                               | 实际稳定的 HTTPS 生产域名                    |
| NEXT_PUBLIC_APP_URL                           | 与 BETTER_AUTH_URL 相同的 HTTPS 域名         |
| SMTP_HOST / SMTP_USER / SMTP_PASS / SMTP_FROM | 邮件供应商参数；当前按用户要求预留 xxxx      |
| SMTP_PORT                                     | 465 或供应商指定端口                         |
| SMTP_SECURE                                   | 465 通常 true，587 STARTTLS 通常 false       |
| SMTP_FROM_NAME                                | BdayMate                                     |

两个 URL 必须替换 localhost，保证站点地址、认证回调和邮件链接处于同一域名。首次域名不确定时，先创建项目取得域名，再更新变量并 Redeploy。NEXT_PUBLIC_APP_URL 在构建时写入，修改后必须重新部署。Preview 请使用独立数据库和匹配的 URL，不向不受信任分支开放生产数据库或邮件凭据。

xxxx 仅为占位。页面可以构建并打开，但注册验证、密码重置、提醒送达仍需真实 SMTP，应用不会绕过验证。SMTP 使用 465/587，不使用端口 25。

## 3. 数据库迁移

本次开发用 Neon 已执行两次迁移，无需重复初始化。使用对应私有配置可执行：

```sh
pnpm db:status
```

新数据库或未来新增迁移时，先备份和检查 SQL，再在受控环境执行 pnpm db:migrate。Vercel 构建仅生成 Prisma Client，不自动迁移或重置数据库，避免 Preview 构建改变生产数据。

## 4. GitHub Actions 定时提醒（本次选定方案）

用户选择 Vercel Hobby，且没有独立定时器。本仓库已提供 .github/workflows/reminders.yml，直接使用现有 GitHub 仓库的 Actions。默认 vercel.json 不声明受 Hobby 限制的分钟级 Cron，无需另购定时服务或运行服务器。

部署网站并完成 SMTP 配置后，在 GitHub 仓库 Settings → Secrets and variables → Actions 填写：

| 类型                   | 名称                            | 值                                                                   |
| ---------------------- | ------------------------------- | -------------------------------------------------------------------- |
| Repository secret      | CRON_SECRET                     | 与 Vercel Production 中 CRON_SECRET 完全相同的私密值                 |
| Repository variable    | BDAYMATE_APP_URL                | 实际稳定 HTTPS 生产域名，仅 origin，不加路径、查询参数或凭据         |
| 可选 Repository secret | VERCEL_AUTOMATION_BYPASS_SECRET | 仅在启用 Vercel Deployment Protection 时填写平台生成的自动化绕过秘密 |

先填 Secret，网站和 SMTP 验收后再填 URL。URL 未配置时工作流跳过，不调用任何站点；缺少或错误的密钥会明确失败，不回退到匿名请求。密码和密钥不会出现在代码或日志中。

定时工作流只在默认分支 main 上执行，因此完整代码和工作流需推送到 main；Vercel Production Branch 同样选择 main。进入 GitHub Actions → BdayMate reminders → Run workflow 可手动验收。可填写精确 user_id，仅处理该账户；留空则处理全部账户。

每 5 分钟启动一次（UTC 每小时第 2、7、12…57 分），先生成未来提醒，再消费最多 3 条。生成失败时仍尝试处理已有到期队列，整体运行标记失败。HTTP 错误和邮件失败会令 Actions 失败，便于查看通知。工作流串行运行，不中断正在发送的前一个任务；未完成积压由后续周期继续处理。客户端禁止跟随重定向，避免把 Bearer 传给其他地址。

这是 GitHub 的尽力调度，可能延迟，不能承诺整分钟送达。当前每轮消费上限适合低流量个人使用；频繁积压或需要更精确/更高吞吐时，应更换专业调度器或持续 Worker。公开仓库 60 天无活动可能自动停用 scheduled workflow，届时需要在 Actions 页面重新启用；不要把网页关闭与仓库调度停用混为一谈。

本次仓库已确认为公开仓库。GitHub-hosted 标准 runner 的额度和政策以账户为准；将来转为私有仓库时需要重新检查 Actions 用量。没有自动创建新账号、订购付费套餐或写入未知的生产域名。

## 5. 上线验收

1. Vercel 构建成功，/login 可打开；匿名 /dashboard 跳转登录。
2. 无 Bearer 的 GET/POST Cron 返回 401；正确密钥返回 200 且响应含 Cache-Control: no-store。验收使用精确 userId 作用域，避免处理其他用户数据。
3. 配置真实 SMTP 后完成注册验证与重置密码，确认邮件链接指向生产域名。
4. 用验收账号添加当天生日并设置到期提醒，关闭浏览器等待调度；检查实际收件箱与页面邮件记录。
5. 在 GitHub Actions 检查连续调度、队列积压和 FAILED 原因。DELIVERY_UNCERTAIN 必须核对供应商记录，不能盲目重发。

Vercel 不运行本仓库的 Docker 常驻 Worker。它仅适用于另行部署的容器主机。本地回归覆盖真实 Neon、本地 SMTP 和 GET/POST 浏览器链路，不代表已经登录 Vercel、填写远程环境变量或完成公网部署。

## 官方依据（2026-11-14 核对）

- [项目配置](https://vercel.com/docs/project-configuration/vercel-json)
- [Node.js 版本](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [包管理器与 Corepack](https://vercel.com/docs/package-managers)
- [Cron 套餐限制](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Cron 鉴权与调度](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [函数时长](https://vercel.com/docs/functions/configuring-functions/duration)

- [GitHub 定时触发与限制](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
