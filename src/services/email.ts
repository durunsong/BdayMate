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
        props.footer || '',
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
    body: `你好，${user.name}。\n\n欢迎来到生日搭子。重要的日子，值得被温柔记住。\n请点击下方「验证邮箱」，确认这份生日空间属于你。`,
    url,
    buttonLabel: '验证邮箱',
    footer:
      '这是一封账户验证邮件。如果你没有注册 BdayMate，请忽略，不需要进行任何操作。',
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
    body: `你好，${user.name}。\n\n我们收到了一次密码重置请求。点击下方按钮，为你的生日空间设置一个新密码。链接将在一小时后失效。`,
    url,
    buttonLabel: '重置密码',
    footer:
      '如果你没有申请重置密码，请忽略这封邮件；你的密码不会因此改变。不要将此链接分享给他人。',
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
      buttonLabel: '看看生日安排',
    },
    options,
  );
}
export type BirthdayGreetingEmail = Pick<
  BirthdayEmail,
  | 'userId'
  | 'recipient'
  | 'contactId'
  | 'contactName'
  | 'birthdayDate'
  | 'queueId'
  | 'messageId'
> & {
  senderName: string;
  message: string;
};
export function sendBirthdayGreetingEmail(
  data: BirthdayGreetingEmail,
  options: { log?: boolean } = {},
) {
  return sendEmail(
    {
      userId: data.userId,
      recipient: data.recipient,
      queueId: data.queueId,
      messageId: data.messageId,
      template: 'BIRTHDAY_GREETING',
      subject: data.contactName + '，生日快乐！',
      heading: data.contactName + '，生日快乐！',
      body: data.message,
      details: [{ label: '来自', value: data.senderName }],
      footer:
        '这封生日祝福由发送者通过 BdayMate 安排。如不希望继续收到，请联系发送者关闭自动祝福。',
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
        buttonLabel: '回到生日搭子',
        footer: '这是一封由你主动发送的测试邮件，用于检查邮件连接。无需回复。',
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
  sendBirthdayGreetingEmail,
  sendTestEmail,
};
