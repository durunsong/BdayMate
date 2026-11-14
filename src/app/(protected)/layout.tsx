import { requireUser } from '@/lib/session';
import { getWorkspace } from '@/services/domain';
import { AppShell } from '@/components/app-shell';
export const dynamic = 'force-dynamic';
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const workspace = await getWorkspace(user.id);
  return <AppShell workspace={workspace}>{children}</AppShell>;
}
