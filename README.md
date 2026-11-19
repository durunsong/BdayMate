# BdayMate · 生日搭子

<img src="public/brand/bdaymate-logo.png" width="96" height="96" alt="BdayMate 生日搭子 Logo" />

品牌图标、浏览器 favicon 与分享预览的维护说明见 [品牌素材](docs/branding.md)。

Never Miss a Special Day. 一个真实连接 PostgreSQL 的个人生日管理应用：公历/农历、联系人和标签、日历、提醒队列、祝福语、礼物与邮件记录。

## 本地运行

需要 Node.js 22.23+、pnpm 10.33.2 和 PostgreSQL（推荐 Neon）。

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# 编辑 .env：数据库连接、随机认证/Cron 密钥、站点 URL、SMTP 参数
pnpm db:generate
pnpm db:migrate
pnpm dev
```

访问 http://localhost:3000。邮箱必须验证后才能进入业务页面。SMTP 使用 `xxxx` 占位时会明确返回未配置；不会绕过验证或伪装邮件送达。要在无邮件供应商时验收，使用下文独立 E2E SMTP 测试环境。

本次提供的 Neon 连接保存在权限为 600、Git 忽略的本地 `.env`。不要复制、提交或截图该文件。示例配置没有真实秘密。

## Vercel 部署

仓库包含 Node.js 22、Singapore 区域、Fluid Compute 和固定 pnpm 安装配置。采用 Vercel Hobby + 仓库内 GitHub Actions 定时器，每 5 分钟生成并消费提醒，无需另建定时服务器。部署后在仓库 Actions 配置生产域名变量与 Cron 密钥，配置前不会调用站点。设置与验收步骤见 [Vercel 部署手册](docs/vercel.md)。两个调度接口均支持鉴权 GET/POST，响应禁止缓存。

## 功能入口

- `/register`、`/login`、`/verify-email`、`/forgot-password`、`/reset-password`：Better Auth 注册、验证、密码 / 邮箱验证码登录和找回密码。验证码登录仅限已注册账户，6 位数字、5 分钟内有效；首次通过验证码验证邮箱后，可在设置 → 账户安全通过邮件设置密码。
- `/dashboard`：联系人总数、今日/本月/7天/30天生日、最近添加与月分布。
- `/contacts`：搜索、关系/标签/月筛选、排序、批量归档/恢复/删除、CSV 导入导出；详情提供独立提醒、礼物及祝福历史。
- `/calendar`：月、周、列表视图，支持年份/月切换及关系/标签筛选。
- `/groups`：自定义彩色标签；内置关系类型独立存储。
- `/reminders`：默认/自定义提醒、任务状态、发送日志、安全失败重试。
- `/wishes`：默认及自定义祝福语，复制和记录发送。
- `/settings`：资料、时区、提醒、安全、会话、账户注销和数据导出/删除。

## 架构与数据

```text
src/app/          页面、Server Actions、认证/Cron/导出接口
src/components/   Radix/shadcn 风格无障碍组件与应用框架
src/features/     客户端业务界面和表单
src/services/     BirthdayService、领域操作、邮件和队列
src/lib/          Prisma、Better Auth、校验、CSV、SMTP 配置
src/stores/       仅客户端 UI 状态
src/emails/       统一 React Email 模板
prisma/           Schema 与版本化 SQL 迁移
tests/            单元、真实数据库/SMTP 集成、浏览器 E2E
openspec/         范围、设计、验收和任务清单
```

认证表及业务表均使用 `bday_` 前缀。每个领域入口从服务端会话获得 userId，所有读取及变更带所有者条件；联系人/标签/提醒/礼物关联使用复合外键保证同一所有者。关键日期、预算、提醒时间和次数另有数据库 CHECK 约束。账号删除级联处理个人数据。

生日口径见 [生日规则](docs/birthday-rules.md)：未知出生年不显示年龄；2 月 29 日默认非闰年 2 月 28 日，可改为 3 月 1 日；农历年份是农历年，无对应闰月默认使用普通月份，也可选择跳过。农历小月三十按该月最后一天庆祝，输入的已知出生日期仍必须真实存在。农历支持 1900–2100 年，越界显式报错。

## 环境变量

| 变量                            | 用途                                                                |
| ------------------------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`                  | Neon pooled 连接，应用使用 Prisma Neon Adapter                      |
| `DIRECT_URL`                    | Neon direct 连接，Prisma CLI 迁移使用；无该项则退回 DATABASE_URL    |
| `BETTER_AUTH_SECRET`            | 至少 32 字符随机秘密，不能用示例值                                  |
| `BETTER_AUTH_URL`               | 认证公开地址，生产必须 HTTPS                                        |
| `NEXT_PUBLIC_APP_URL`           | 应用公开地址，构建及运行环境保持一致                                |
| `SMTP_HOST/PORT/SECURE`         | SMTP 主机、端口、直接 TLS（465 通常 true，587 通常 false+STARTTLS） |
| `SMTP_USER/PASS/FROM/FROM_NAME` | 邮件账号密码、发件邮箱和品牌名称                                    |
| `CRON_SECRET`                   | 至少 32 字符独立随机 Bearer 密钥                                    |

可用 `openssl rand -base64 48` 生成随机秘密。对外 SMTP 强制 TLS、验证服务器证书。只有 loopback SMTP 测试允许明文传输。提前提醒发给 BdayMate 账户邮箱；联系人详情中可独立开启生日当天自动祝福，发送到该联系人的邮箱。默认关闭，不会因填写邮箱而自动开启。

## 提醒与独立 Worker

提醒不是浏览器定时器。两阶段任务先把未来 45 天发送窗口持久化（同时枚举提前提醒需要的更远生日），再由 Worker 原子领取到期任务。联系人、时区和提醒偏好修改在同一用户事务锁内重建未发送任务。自定义提前天数 0–45，最多 12 个不同值；默认 7、3、1、0 天和当地 09:00。所有队列时间保存为 UTC。

```sh
pnpm cron:generate
pnpm cron:process
```

这两个命令向运行中的应用发起带 Bearer 的 POST：

- `/api/cron/generate-reminders`
- `/api/cron/process-email-queue`

外部调度器可以使用 GET 或 POST，并设置 `Authorization: Bearer <CRON_SECRET>`。可传 JSON `{"userId":"指定用户 ID"}` 限定验收范围；生产调度省略 userId 处理全部用户。不要把密钥写进公开 URL。建议每 5 分钟生成、每分钟消费；部署方案见 [运行手册](docs/operations.md)。

唯一 dedupeKey、PostgreSQL 原子领取、用户级事务锁及有限重试防止常规并发重复发送。失败指数退避，最多 5 次。SMTP 接受邮件后进程中断属于不可判定结果，标准 SMTP 无法实现跨系统严格 exactly-once：这类任务标记 `DELIVERY_UNCERTAIN`，不会盲目重发，需要管理员查供应商记录。`CANCELLED` 表示配置变更导致任务失效。发送成功表示 SMTP 已接受，最终收件箱送达仍由供应商负责。

## CSV

UTF-8、RFC4180 风格引号。`name,birthdayType` 必填表头；SOLAR 需要 solarMonth/solarDay，LUNAR 需要 lunarMonth/lunarDay。可选 birthYear、isLeapMonth、关系、email、phone、notes、tags、avatar、gender 和日期策略。tags 用 `|` 分隔；relationship 使用 FAMILY/FRIEND/CLASSMATE/COLLEAGUE/MANAGER/CLIENT/PARTNER/OTHER。先从列表导出可得到完整表头。最多 2 MB / 500 人；整批先校验，任何错误不部分写入；重复同名同生日会提示。CSV 导出为潜在公式单元格加前导单引号，防止表格公式注入。

## 验证

```sh
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
pnpm db:status
```

数据库集成测试需要可写的专用开发库；只创建唯一 `test-…@example.test` 账号并按本次记录 ID 清理。测试不会清空已有数据。E2E 启动独立 loopback SMTP 捕获与测试应用；详情见 [E2E 手册](docs/e2e.md)。外部 SMTP 由部署环境配置；回归测试始终覆盖为本地捕获服务，不向真实联系人试发。

## 版本与交付状态

锁文件固定可复现依赖。Next/React 使用本次查询到的稳定版本；Prisma 7.10.1 避开不兼容的 8 RC。TypeScript 6.0 和 ESLint 9 使用 Next ESLint 插件当前声明支持的版本范围；后续随上游插件一起升级。任务书指定的 `@react-email/components` 已被上游标记 deprecated，目前仍用于品牌模板；安装和审计信息记录于开发进度，不声称依赖永无风险。

原始需求在 [requirements.md](docs/requirements.md)，逐项交付/验证状态见 [progress.md](docs/progress.md)。项目保留上游 Apache-2.0 LICENSE。

## 生日与两类邮件

- 每年按记录的公历/农历生日重新计算；支持边界、闰月/闰日规则及 HKO 全量核对见 [生日规则](docs/birthday-rules.md)。
- 提醒自己：全局或联系人独立设置提前 0–45 天（最多 12 个提醒日）和时间，0 表示当天提醒本人。
- 祝福联系人：填写联系人邮箱，在详情中开启“自动生日祝福”，设置时间和正文；按你的时区，每次生日一次。关闭自我提醒不会关闭已开启的联系人祝福。
- 归档、移除邮箱、关闭祝福或修改生日会同步取消/重排未发送任务。已过提醒日不集中补发；当天已到时间的新设置会进入到期队列。
- 本次新增 ContactGreetingSetting 表的迁移需在部署新版前执行；既有联系人默认不发送祝福。
- GitHub Actions 每 5 分钟尽力触发，可能延迟，不能保证整分钟到达。队列接受成功不等于收件箱实际送达。
