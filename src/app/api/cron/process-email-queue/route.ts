import { authorizeCron, cronError, readCronOptions } from '@/lib/cron-auth';
import { processEmailQueue } from '@/services/reminders';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    authorizeCron(request);
    const options = await readCronOptions(request);
    const result = await processEmailQueue(options);
    return Response.json(
      { ok: true, ...result },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return cronError(error);
  }
}

export const GET = POST;
