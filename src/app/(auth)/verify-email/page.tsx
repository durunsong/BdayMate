import { AuthForm } from '@/features/auth';
import { currentUser } from '@/lib/session';
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; verified?: string; error?: string }>;
}) {
  const params = await searchParams;
  const verifiedUser = await currentUser();
  return (
    <AuthForm
      mode="verify"
      email={params.email}
      verified={!!verifiedUser}
      errorCode={params.error}
    />
  );
}
