import Link from 'next/link';
import { Button } from '@/components/ui';
export default function NotFound() {
  return (
    <main className="standalone-message">
      <h1>找不到这个页面</h1>
      <p>它可能已被移除，或你没有访问权限。</p>
      <Button asChild>
        <Link href="/dashboard">回到生日概览</Link>
      </Button>
    </main>
  );
}
