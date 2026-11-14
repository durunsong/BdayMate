import { requireUser } from '@/lib/session';
import { getWorkspace } from '@/services/domain';
import { SettingsPageContent } from '@/features/settings';
export default async function SettingsPage() {
  const user = await requireUser();
  return <SettingsPageContent workspace={await getWorkspace(user.id)} />;
}
