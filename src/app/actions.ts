'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authenticatedUser } from '@/lib/session';
import { mutate } from '@/services/domain';
import { safeError } from '@/lib/errors';
import type { ActionResult } from '@/lib/types';
export async function performAction(
  name: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await authenticatedUser();
    const result = await mutate(user.id, name, input);
    revalidatePath('/', 'layout');
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? error.issues[0]?.message || '请检查输入内容'
          : safeError(error),
    };
  }
}
