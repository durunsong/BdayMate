import { authenticatedUser } from '@/lib/session';
import { exportContacts } from '@/services/domain';
import { DomainError, safeError } from '@/lib/errors';
export async function GET() {
  try {
    const user = await authenticatedUser();
    return new Response(await exportContacts(user.id), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="bdaymate-contacts.csv"',
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
