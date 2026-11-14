'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { performAction } from '@/app/actions';
import type { ActionResult } from '@/lib/types';
export function useAction() {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function run(name: string, input: unknown): Promise<ActionResult> {
    if (pending) return { ok: false, message: '操作正在进行，请稍候' };
    setPending(true);
    try {
      const result = await performAction(name, input);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.message);
      return result;
    } catch {
      const message = '暂时无法完成操作，请检查网络后重试';
      toast.error(message);
      return { ok: false, message };
    } finally {
      setPending(false);
    }
  }
  return { run, pending };
}
