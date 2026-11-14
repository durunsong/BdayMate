import { authorizeCron, cronError, readCronOptions } from '@/lib/cron-auth';
import { generateReminders } from '@/services/reminders';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    authorizeCron(request);
    const { userId } = await readCronOptions(request);
    const result = await generateReminders({ userId });
    return Response.json(
      { ok: true, ...result },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return cronError(error);
  }
}

// Vercel Cron invokes GET; both methods share authentication and validation.
export const GET = POST;
