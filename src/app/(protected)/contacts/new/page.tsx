import { requireUser } from '@/lib/session';
import { getWorkspace } from '@/services/domain';
import { ContactForm } from '@/features/contact-form';
export default async function NewContactPage() {
  const user = await requireUser();
  return <ContactForm workspace={await getWorkspace(user.id)} />;
}
