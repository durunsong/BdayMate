import 'server-only';
import { z } from 'zod';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DomainError } from './errors';

export function authorizeCron(request: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === 'xxxx') throw new DomainError('Cron 尚未配置', 503);
  const authorization = request.headers.get('authorization') || '';
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest();
  const provided = createHash('sha256').update(authorization).digest();
  if (!timingSafeEqual(expected, provided))
    throw new DomainError('Cron 身份验证失败', 401);
}

const cronInput = z
  .object({
    userId: z.string().trim().min(1).max(128).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export async function readCronOptions(
  request: Request,
): Promise<{ userId?: string; limit?: number }> {
  if (Number(request.headers.get('content-length') || 0) > 1024)
    throw new DomainError('Cron 请求过大', 400);
  let input: unknown;
  if (request.method === 'GET') {
    const query = new URL(request.url).searchParams;
    if (query.toString().length > 1024)
      throw new DomainError('Cron 请求过大', 400);
    input = {
      ...Object.fromEntries(query),
      ...(query.has('limit') ? { limit: Number(query.get('limit')) } : {}),
    };
  } else {
    const body = await request.text();
    if (body.length > 1024) throw new DomainError('Cron 请求过大', 400);
    try {
      input = body.trim() ? JSON.parse(body) : {};
    } catch {
      throw new DomainError('Cron 请求必须是有效 JSON', 400);
    }
  }
  const result = cronInput.safeParse(input);
  if (!result.success) throw new DomainError('Cron 参数无效', 400);
  return result.data;
}

export function cronError(error: unknown): Response {
  return Response.json(
    {
      ok: false,
      error:
        error instanceof DomainError
          ? error.message
          : 'Cron 执行失败，请检查服务状态后重试',
    },
    {
      status: error instanceof DomainError ? error.status : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
