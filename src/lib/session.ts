import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './auth';
import { DomainError } from './errors';
export async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.emailVerified ? session.user : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}
export async function authenticatedUser() {
  const user = await currentUser();
  if (!user) throw new DomainError('请先登录并验证邮箱', 401);
  return user;
}
