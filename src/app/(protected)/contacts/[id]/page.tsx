import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getWorkspace } from '@/services/domain';
import { ContactDetail } from '@/features/contact-detail';
export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const workspace = await getWorkspace(user.id);
  const contact = workspace.contacts.find((c) => c.id === id);
  if (!contact) notFound();
  return <ContactDetail workspace={workspace} contact={contact} />;
}
