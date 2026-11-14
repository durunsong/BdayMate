import { authenticatedUser } from '@/lib/session';
import { exportData } from '@/services/domain';
import { DomainError, safeError } from '@/lib/errors';
export async function GET() {
  try {
    const user = await authenticatedUser();
    return new Response(JSON.stringify(await exportData(user.id), null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="bdaymate-data.json"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return Response.json(
      { error: safeError(e) },
      { status: e instanceof DomainError ? e.status : 500 },
    );
  }
}
