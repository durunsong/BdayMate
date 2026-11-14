import { requireUser } from '@/lib/session';
import { getWorkspace } from '@/services/domain';
import { ReminderManagement } from '@/features/reminders';
export default async function RemindersPage() {
  const user = await requireUser();
  return <ReminderManagement workspace={await getWorkspace(user.id)} />;
}
