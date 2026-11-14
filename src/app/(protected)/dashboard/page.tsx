import { requireUser } from '@/lib/session';
import { getWorkspace } from '@/services/domain';
import { Dashboard } from '@/features/dashboard';
export default async function DashboardPage() {
  const user = await requireUser();
  return <Dashboard workspace={await getWorkspace(user.id)} />;
}
