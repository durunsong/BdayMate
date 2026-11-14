# 品牌素材

使用用户提供的紫色日历与生日蛋糕 Logo。仅裁去原图外部留白、等比例缩放，不重绘文字、图案或配色。

| 文件                             | 尺寸              | 用途                             |
| -------------------------------- | ----------------- | -------------------------------- |
| `public/brand/bdaymate-logo.png` | 512 × 512         | 应用共用 Logo、邮件与应用清单    |
| `public/brand/icon-192.png`      | 192 × 192         | 添加到主屏幕时的应用图标         |
| `src/app/favicon.ico`            | 16 / 32 / 48 / 64 | 浏览器标签页与收藏夹，多尺寸 ICO |
| `src/app/icon.png`               | 32 × 32           | 浏览器 PNG 图标                  |
| `src/app/apple-icon.png`         | 180 × 180         | Apple 主屏幕图标                 |
| `src/app/opengraph-image.png`    | 1200 × 630        | 分享预览，白底居中展示原 Logo    |

`src/app/manifest.ts` 定义应用名称、主屏幕入口和图标；这不提供离线缓存。文件式图标与分享图片由 Next.js 自动生成 metadata 链接。ICO 内嵌 PNG 必须为 RGBA 格式，以兼容生产构建的图片解码器。

`Brand` 共用于登录、注册、密码找回、桌面侧栏与手机菜单。图像显式声明尺寸，链接保留可访问名称，Next Image 按展示尺寸优化传输。邮件使用绝对图片 URL，同时保留文字品牌名，以兼容默认屏蔽图片的收件客户端。

生产环境的 `NEXT_PUBLIC_APP_URL` 应为正式站点 origin，供分享 metadata 和邮件图片解析使用。替换素材后应重新构建；浏览器或分享平台可能保留旧缓存，检查时可使用新标签页或强制刷新。

回归入口：

```sh
pnpm exec vitest run tests/unit/branding.test.ts
PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e
pnpm lint
pnpm build
pnpm typecheck
```

浏览器回归检查桌面和手机的 Logo 加载、横向溢出、favicon 文件内容、Apple 图标、应用清单、分享图片，以及登录后桌面侧栏和手机菜单。
