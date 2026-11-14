import { requireUser } from '@/lib/session';
import { getWorkspace } from '@/services/domain';
import { BirthdayCalendar } from '@/features/calendar';
export default async function CalendarPage() {
  const user = await requireUser();
  return <BirthdayCalendar workspace={await getWorkspace(user.id)} />;
}
