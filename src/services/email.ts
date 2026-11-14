import 'server-only';
import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import { createElement } from 'react';
import { BrandedEmail, type BrandedEmailProps } from '@/emails/branded';
import { smtpConfig } from '@/lib/email-config';
import { safeError } from '@/lib/errors';
import { db } from '@/lib/db';
import { relationships, type Relationship } from '@/lib/types';

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;
let transportKey = '';
export function createTransporter() {
  const config = smtpConfig();
  const key = JSON.stringify(config);
  if (!transporter || key !== transportKey) {
    transporter?.close();
    transporter = nodemailer.createTransport(config);
    transportKey = key;
  }
  return transporter;
}
export function closeTransporter() {
  transporter?.close();
  transporter = undefined;
  transportKey = '';
}
export async function verifySMTPConnection() {
  await createTransporter().verify();
  return true;
}
export type EmailInput = BrandedEmailProps & {
  userId: string;
  recipient: string;
  subject: string;
  template: string;
  queueId?: string;
  messageId?: string;
};
export type BirthdayEmail = {
  userId: string;
  recipient: string;
  contactId: string;
  contactName: string;
  birthdayDate: string;
  daysBefore: number;
  relationship: Relationship;
  age: number | null;
  notes: string | null;
  queueId?: string;
  messageId?: string;
};
export async function sendEmail(
  input: EmailInput,
  { log = true }: { log?: boolean } = {},
) {
  const { userId, recipient, subject, template, queueId, messageId, ...props } =
    input;
  try {
    const html = await render(createElement(BrandedEmail, props));
    const info = await createTransporter().sendMail({
      from: smtpConfig().from,
      to: recipient,
      subject,
      html,
      text: [
        props.heading,
        props.body,
        ...(props.details || []).map((d) => `${d.label}：${d.value}`),
        props.url || '',
      ].join('\n\n'),
      ...(messageId ? { messageId } : {}),
    });
    if (!info.accepted?.length)
      throw Object.assign(new Error('SMTP rejected recipient'), {
        code: 'EENVELOPE',
      });
    if (log)
      await db.emailLog.create({
        data: {
          userId,
          recipient,
          subject,
          template,
          queueId,
          status: 'SENT',
          sentAt: new Date(),
          messageId: info.messageId,
        },
      });
    return { messageId: info.messageId as string };
  } catch (error) {
    if (log)
      await db.emailLog.create({
        data: {
          userId,
          recipient,
          subject,
          template,
          queueId,
          status: 'FAILED',
          error: safeError(error),
        },
      });
    throw error;
  }
}
export function sendVerificationEmail(
  user: { id: string; email: string; name: string },
  url: string,
) {
  return sendEmail({
    userId: user.id,
    recipient: user.email,
    template: 'VERIFICATION',
    subject: '验证你的 BdayMate 邮箱',
    heading: '让每一份心意，准时抵达',
    body: `你好，${user.name}。请点击下方链接验证邮箱，开启你的生日搭子。若不是你发起的请求，请忽略此邮件。`,
    url,
    buttonLabel: '验证邮箱',
  });
}
export function sendPasswordResetEmail(
  user: { id: string; email: string; name: string },
  url: string,
) {
  return sendEmail({
    userId: user.id,
    recipient: user.email,
    template: 'PASSWORD_RESET',
    subject: '重置你的 BdayMate 密码',
    heading: '重新设置密码',
    body: '我们收到了一次密码重置请求。链接将在一小时后失效。如非本人操作，请忽略这封邮件。',
    url,
    buttonLabel: '重置密码',
  });
}
export function sendBirthdayReminderEmail(
  data: BirthdayEmail,
  options: { log?: boolean } = {},
) {
  return sendEmail(
    {
      userId: data.userId,
      recipient: data.recipient,
      queueId: data.queueId,
      messageId: data.messageId,
      template: 'BIRTHDAY',
      subject:
        data.daysBefore === 0
          ? `今天是 ${data.contactName} 的生日`
          : `${data.contactName} 的生日还有 ${data.daysBefore} 天`,
      heading:
        data.daysBefore === 0
          ? `今天，为 ${data.contactName} 庆祝`
          : `为 ${data.contactName} 留一份心意`,
      body:
        data.daysBefore === 0
          ? '今天就是特别的日子，送上一句真心的祝福吧。'
          : `距离生日还有 ${data.daysBefore} 天，准备惊喜正当时。`,
      details: [
        { label: '生日', value: data.birthdayDate },
        { label: '关系', value: relationships[data.relationship] },
        ...(data.age === null
          ? []
          : [{ label: '年龄', value: `${data.age} 岁` }]),
        ...(data.notes ? [{ label: '备注', value: data.notes }] : []),
      ],
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/contacts/${encodeURIComponent(data.contactId)}`,
    },
    options,
  );
}
export async function sendTestEmail(user: { id: string; email: string }) {
  const subject = 'BdayMate 测试邮件';
  // Persist before verify, so configuration/connection failures are visible and rate-limited.
  const log = await db.emailLog.create({
    data: {
      userId: user.id,
      recipient: user.email,
      template: 'SMTP_TEST',
      subject,
      status: 'PENDING',
    },
  });
  try {
    await verifySMTPConnection();
    const result = await sendEmail(
      {
        userId: user.id,
        recipient: user.email,
        template: 'SMTP_TEST',
        subject,
        heading: '邮件服务已连接',
        body: '这是你在 BdayMate 发起的测试邮件。收到这封邮件说明当前 SMTP 服务已接受发送。',
        url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      { log: false },
    );
    await db.emailLog.update({
      where: { id: log.id },
      data: { status: 'SENT', sentAt: new Date(), messageId: result.messageId },
    });
    return result;
  } catch (error) {
    await db.emailLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', error: safeError(error) },
    });
    throw error;
  }
}
export const EmailService = {
  createTransporter,
  verifySMTPConnection,
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBirthdayReminderEmail,
  sendTestEmail,
};
