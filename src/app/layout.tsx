import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'BdayMate · 生日搭子', template: '%s · BdayMate' },
  description: '记住重要的人，认真对待每一个生日。支持公历、农历与邮件提醒。',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Toaster
          richColors
          position="top-center"
          closeButton
          toastOptions={{ className: 'bday-toast' }}
        />
      </body>
    </html>
  );
}
