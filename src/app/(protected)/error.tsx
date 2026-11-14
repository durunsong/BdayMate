'use client';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button, EmptyState, Panel } from '@/components/ui';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Panel>
      <EmptyState
        title="这个页面暂时没有加载成功"
        description="你的数据仍然安全。请稍后重试，或返回生日概览。"
        icon={<AlertCircle size={30} />}
      />
      <div className="centered-actions">
        <Button onClick={reset}>
          <RefreshCw size={16} />
          重新加载
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/dashboard">返回概览</Link>
        </Button>
      </div>
    </Panel>
  );
}
