import { AuthForm } from '@/features/auth';
import { currentUser } from '@/lib/session';
import { redirect } from 'next/navigation';
export default async function RegisterPage() {
  if (await currentUser()) redirect('/dashboard');
  return <AuthForm mode="register" />;
}
