import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { themeBootstrap } from '@/lib/theme';
import { Suspense } from 'react';
import { NavigationProgress } from '@/components/navigation-progress';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://bdaymate.vercel.app',
  ),
  applicationName: 'BdayMate · 生日搭子',
  title: { default: 'BdayMate · 生日搭子', template: '%s · BdayMate' },
  description: '记住重要的人，认真对待每一个生日。支持公历、农历与邮件提醒。',
  appleWebApp: { title: '生日搭子', capable: true },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: 'BdayMate · 生日搭子',
    title: 'BdayMate · 生日搭子',
    description: '记住重要的人，认真对待每一个生日。支持公历、农历与邮件提醒。',
  },
  twitter: { card: 'summary_large_image' },
};
export const viewport: Viewport = { themeColor: '#6421d9' };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
      </head>
      <body>
        <ThemeProvider>
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
