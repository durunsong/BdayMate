# 生日计算规则

入口为纯函数服务 BirthdayService（无 Prisma、网络或 server-only 依赖）。日期统一使用严格的 yyyy-MM-dd 格式；错误输入、超出支持范围、范围内找不到下一次生日时抛出 RangeError，调用方应展示错误，不应悄悄省略联系人。

- next(input, timeZone, now) 包含今天，从用户 IANA 时区的当前民用日期开始寻找下一次生日。
- between(input, start, end, timeZone) 包含两端，按日期升序返回；起止参数已经是该用户的民用日期，不再当作 UTC 时刻转换。
- daysUntil 是民用日期差；范围查询相对 start，下一次查询相对用户今天。以 UTC 日期表示相减，避免夏令时的 23/25 小时日影响。
- 时区交给运行时 Intl 的 IANA 数据验证，接受 UTC 及 IANA 别名，拒绝纯偏移值（如 +08:00）。
- SOLAR 的 birthYear 表示公历出生年，LUNAR 表示农历出生年；返回年龄为生日所属历法的年份减出生年份，属于该次生日将达到的年龄。未知年份返回 null。不会返回出生年之前的生日，出生当天年龄为 0。
- 公历范围为 0001–9999 年。2 月 29 日在非闰年默认按 2 月 28 日（FEB28），可选择 3 月 1 日（MAR1）；闰年仍为 2 月 29 日。
- 农历产品支持范围为农历 1900–2100 年完整年份，对应公历 **1900-01-31 至 2101-01-28**（含两端）。来源农历年、转换输入、查询范围均明确校验；这一边界是产品支持政策，不代表上游算法的全部覆盖范围。
- 按农历年枚举候选生日，再转公历，不将公历年直接当作农历年。一个公历年可能有同一联系人的两次农历生日，两次均保留。
- 闰月生日在有对应闰月的年份只在闰月出现一次；没有时默认在同名常规月过生日（REGULAR），也可跳过该农历年（SKIP）。SKIP 的下一次查询会继续寻找，不局限于下一年。
- 每年的农历月份只有 29 天时，周年日“三十”落在该月最后一天；未知出生年允许记录三十。已知出生年的原始日期必须真实存在，不允许通过闰月回退或月末截断把错误出生日期变合法。
- 公历转农历结果的月份为正数 1–12，闰月另用 isLeapMonth 表示。适配层内部才使用上游库的负数闰月编码。
- 农历转换采用中国历法的民用日期；用户时区决定“今天”和提醒日期，不重新按用户所在地计算天文朔日。持久化提醒时间转换为 UTC 的职责属于调度层。

## 依据与验证

- 上游 API：[lunar-javascript / 6tail](https://6tail.cn/calendar/api.html)。适配层只使用 Lunar、LunarMonth、Solar 的日期转换与月长 API。
- 独立已知日期依据：香港天文台 [2023 年对照表](https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2023e.pdf)、[2024 年对照表](https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2024e.pdf)、[2025 年对照表](https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2025e.pdf)。
- 执行 pnpm exec vitest run tests/unit/birthday.test.ts，覆盖春节跨年、闰月、月末、源日期合法性、未知年份、范围边界和 DST。
