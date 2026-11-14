export const relationships = {
  FAMILY: '家人',
  FRIEND: '朋友',
  CLASSMATE: '同学',
  COLLEAGUE: '同事',
  MANAGER: '领导',
  CLIENT: '客户',
  PARTNER: '合作伙伴',
  OTHER: '其他',
} as const;
export type Relationship = keyof typeof relationships;
export type TagDTO = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  count: number;
};
export type ContactDTO = {
  id: string;
  name: string;
  avatar: string | null;
  gender: string | null;
  birthdayType: 'SOLAR' | 'LUNAR';
  birthYear: number | null;
  solarMonth: number | null;
  solarDay: number | null;
  lunarMonth: number | null;
  lunarDay: number | null;
  isLeapMonth: boolean;
  leapDayPolicy: 'FEB28' | 'MAR1';
  lunarLeapPolicy: 'REGULAR' | 'SKIP';
  relationship: Relationship;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  archivedAt: string | null;
  tags: TagDTO[];
  next: { date: string; daysUntil: number; age: number | null } | null;
  birthdayError?: string;
  greetingSetting: {
    enabled: boolean;
    sendTime: string;
    message: string;
  } | null;
  reminderSetting: {
    enabled: boolean;
    daysBefore: number[];
    sendTime: string;
  } | null;
};
export type GiftDTO = {
  id: string;
  contactId: string;
  name: string;
  description: string | null;
  budget: string | null;
  currency: string;
  purchaseUrl: string | null;
  givenAt: string | null;
  status: 'IDEA' | 'PLANNED' | 'PURCHASED' | 'GIVEN';
};
export type Workspace = {
  user: { id: string; name: string; email: string; image: string | null };
  timeZone: string;
  preference: { emailEnabled: boolean; daysBefore: number[]; sendTime: string };
  contacts: ContactDTO[];
  tags: TagDTO[];
  wishes: {
    id: string;
    title: string;
    content: string;
    relationship: Relationship;
  }[];
  gifts: GiftDTO[];
  wishRecords: {
    id: string;
    contactId: string;
    content: string;
    sentAt: string;
  }[];
  notifications: {
    id: string;
    title: string;
    body: string;
    href: string | null;
    readAt: string | null;
    createdAt: string;
  }[];
  queue: {
    id: string;
    subject: string;
    recipient: string;
    scheduledAt: string;
    status: string;
    attemptCount: number;
    lastError: string | null;
  }[];
  emailLogs: {
    id: string;
    subject: string;
    recipient: string;
    template: string;
    status: string;
    error: string | null;
    sentAt: string | null;
    createdAt: string;
  }[];
  smtpConfigured: boolean;
};
export type ActionResult = { ok: boolean; message: string; data?: unknown };
