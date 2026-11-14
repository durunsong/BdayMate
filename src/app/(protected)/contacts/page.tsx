import { requireUser } from '@/lib/session';
import { getWorkspace } from '@/services/domain';
import { Contacts } from '@/features/contacts';
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; relationship?: string }>;
}) {
  const user = await requireUser();
  const search = await searchParams;
  return (
    <Contacts
      workspace={await getWorkspace(user.id)}
      initialTag={search.tag}
      initialRelationship={search.relationship}
    />
  );
}
