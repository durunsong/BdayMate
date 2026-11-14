import { currentUser } from '@/lib/session';
import { Landing } from '@/features/landing';

export default async function Home() {
  const user = await currentUser();
  return <Landing signedIn={Boolean(user)} />;
}
