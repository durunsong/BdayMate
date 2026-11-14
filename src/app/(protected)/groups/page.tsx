import { requireUser } from '@/lib/session';
import { getWorkspace } from '@/services/domain';
import { Groups } from '@/features/groups';
export default async function GroupsPage() {
  const user = await requireUser();
  return <Groups workspace={await getWorkspace(user.id)} />;
}
