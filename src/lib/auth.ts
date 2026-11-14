import 'server-only';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { db } from './db';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmail,
} from '@/services/email';
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/delete-user') return;
      // A fresh session is insufficient for this destructive action. Better Auth
      // still verifies the supplied password against the credential account.
      if (
        typeof ctx.body?.password !== 'string' ||
        ctx.body.password.length === 0
      ) {
        throw new APIError('BAD_REQUEST', {
          code: 'PASSWORD_REQUIRED',
          message: '注销账户前请输入当前密码',
        });
      }
    }),
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    resetPasswordTokenExpiresIn: 3600,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user, url);
    },
  },
  user: {
    deleteUser: { enabled: true },
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await sendEmail({
          userId: user.id,
          recipient: user.email,
          template: 'CHANGE_EMAIL',
          subject: '确认更改 BdayMate 邮箱',
          heading: '确认你的新邮箱',
          body: `你申请将账户邮箱修改为 ${newEmail}。确认后还需验证新邮箱。若不是你本人操作，请立即修改密码。`,
          url,
          buttonLabel: '确认修改',
        });
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 60, max: 5 },
      '/request-password-reset': { window: 60, max: 3 },
    },
  },
  plugins: [nextCookies()],
  logger: {
    level: 'error',
    log: () => {
      console.error(
        'Authentication operation failed; consult configuration and email delivery records.',
      );
    },
  },
});
