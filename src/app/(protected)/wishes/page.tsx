import { requireUser } from '@/lib/session';
import { getWorkspace } from '@/services/domain';
import { Wishes } from '@/features/wishes';
export default async function WishesPage() {
  const user = await requireUser();
  return <Wishes workspace={await getWorkspace(user.id)} />;
}
