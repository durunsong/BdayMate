-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BirthdayType" AS ENUM ('SOLAR', 'LUNAR');

-- CreateEnum
CREATE TYPE "Relationship" AS ENUM ('FAMILY', 'FRIEND', 'CLASSMATE', 'COLLEAGUE', 'MANAGER', 'CLIENT', 'PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('IDEA', 'PLANNED', 'PURCHASED', 'GIVEN');

-- CreateTable
CREATE TABLE "bday_user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bday_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bday_session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "bday_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bday_account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bday_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bday_verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bday_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bday_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bday_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bday_contact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "gender" TEXT,
    "birthdayType" "BirthdayType" NOT NULL DEFAULT 'SOLAR',
    "birthYear" INTEGER,
    "solarMonth" INTEGER,
    "solarDay" INTEGER,
    "lunarMonth" INTEGER,
    "lunarDay" INTEGER,
    "isLeapMonth" BOOLEAN NOT NULL DEFAULT false,
    "leapDayPolicy" TEXT NOT NULL DEFAULT 'FEB28',
    "lunarLeapPolicy" TEXT NOT NULL DEFAULT 'REGULAR',
    "relationship" "Relationship" NOT NULL DEFAULT 'FRIEND',
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "bday_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bday_tag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bday_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bday_contact_tag" (
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "bday_contact_tag_pkey" PRIMARY KEY ("contactId","tagId")
);

-- CreateTable
CREATE TABLE "bday_reminder_preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "daysBefore" INTEGER[] DEFAULT ARRAY[7, 3, 1, 0]::INTEGER[],
    "sendTime" TEXT NOT NULL DEFAULT '09:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bday_reminder_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bday_contact_reminder" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "daysBefore" INTEGER[] DEFAULT ARRAY[7, 3, 1, 0]::INTEGER[],
    "sendTime" TEXT NOT NULL DEFAULT '09:00',

    CONSTRAINT "bday_contact_reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bday_email_queue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT,
    "recipient" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bday_email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bday_email_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "queueId" TEXT,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "error" TEXT,
    "messageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bday_email_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bday_notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bday_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bday_wish" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "relationship" "Relationship" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bday_wish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bday_gift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "budget" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "purchaseUrl" TEXT,
    "givenAt" DATE,
    "status" "GiftStatus" NOT NULL DEFAULT 'IDEA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bday_gift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bday_user_email_key" ON "bday_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "bday_session_token_key" ON "bday_session"("token");

-- CreateIndex
CREATE INDEX "bday_session_userId_idx" ON "bday_session"("userId");

-- CreateIndex
CREATE INDEX "bday_account_userId_idx" ON "bday_account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "bday_account_providerId_accountId_key" ON "bday_account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "bday_verification_identifier_idx" ON "bday_verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "bday_profile_userId_key" ON "bday_profile"("userId");

-- CreateIndex
CREATE INDEX "bday_contact_userId_archivedAt_idx" ON "bday_contact"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "bday_contact_userId_name_idx" ON "bday_contact"("userId", "name");

-- CreateIndex
CREATE INDEX "bday_contact_userId_relationship_idx" ON "bday_contact"("userId", "relationship");

-- CreateIndex
CREATE UNIQUE INDEX "bday_contact_id_userId_key" ON "bday_contact"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "bday_tag_id_userId_key" ON "bday_tag"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "bday_tag_userId_name_key" ON "bday_tag"("userId", "name");

-- CreateIndex
CREATE INDEX "bday_contact_tag_tagId_userId_idx" ON "bday_contact_tag"("tagId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "bday_reminder_preference_userId_key" ON "bday_reminder_preference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "bday_contact_reminder_contactId_key" ON "bday_contact_reminder"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "bday_contact_reminder_contactId_userId_key" ON "bday_contact_reminder"("contactId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "bday_email_queue_dedupeKey_key" ON "bday_email_queue"("dedupeKey");

-- CreateIndex
CREATE INDEX "bday_email_queue_status_scheduledAt_idx" ON "bday_email_queue"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "bday_email_queue_userId_contactId_idx" ON "bday_email_queue"("userId", "contactId");

-- CreateIndex
CREATE INDEX "bday_email_log_userId_createdAt_idx" ON "bday_email_log"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "bday_notification_userId_readAt_createdAt_idx" ON "bday_notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "bday_wish_userId_relationship_idx" ON "bday_wish"("userId", "relationship");

-- CreateIndex
CREATE INDEX "bday_gift_userId_contactId_idx" ON "bday_gift"("userId", "contactId");

-- AddForeignKey
ALTER TABLE "bday_session" ADD CONSTRAINT "bday_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "bday_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_account" ADD CONSTRAINT "bday_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "bday_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_profile" ADD CONSTRAINT "bday_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "bday_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_contact" ADD CONSTRAINT "bday_contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "bday_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_tag" ADD CONSTRAINT "bday_tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "bday_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_contact_tag" ADD CONSTRAINT "bday_contact_tag_contactId_userId_fkey" FOREIGN KEY ("contactId", "userId") REFERENCES "bday_contact"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_contact_tag" ADD CONSTRAINT "bday_contact_tag_tagId_userId_fkey" FOREIGN KEY ("tagId", "userId") REFERENCES "bday_tag"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_reminder_preference" ADD CONSTRAINT "bday_reminder_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "bday_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_contact_reminder" ADD CONSTRAINT "bday_contact_reminder_contactId_userId_fkey" FOREIGN KEY ("contactId", "userId") REFERENCES "bday_contact"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_email_queue" ADD CONSTRAINT "bday_email_queue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "bday_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_email_queue" ADD CONSTRAINT "bday_email_queue_contactId_userId_fkey" FOREIGN KEY ("contactId", "userId") REFERENCES "bday_contact"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_email_log" ADD CONSTRAINT "bday_email_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "bday_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_email_log" ADD CONSTRAINT "bday_email_log_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "bday_email_queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_notification" ADD CONSTRAINT "bday_notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "bday_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_wish" ADD CONSTRAINT "bday_wish_userId_fkey" FOREIGN KEY ("userId") REFERENCES "bday_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_gift" ADD CONSTRAINT "bday_gift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "bday_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_gift" ADD CONSTRAINT "bday_gift_contactId_userId_fkey" FOREIGN KEY ("contactId", "userId") REFERENCES "bday_contact"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Domain invariants are enforced even for writes outside the application.
ALTER TABLE "bday_contact" ADD CONSTRAINT "contact_name_nonempty" CHECK (length(trim("name")) BETWEEN 1 AND 100);
ALTER TABLE "bday_contact" ADD CONSTRAINT "contact_birthday_valid" CHECK (
 ("birthdayType" = 'SOLAR' AND "solarMonth" IS NOT NULL AND "solarDay" IS NOT NULL AND "solarMonth" BETWEEN 1 AND 12 AND "solarDay" BETWEEN 1 AND 31 AND "lunarMonth" IS NULL AND "lunarDay" IS NULL AND "isLeapMonth" = false) OR
 ("birthdayType" = 'LUNAR' AND "lunarMonth" IS NOT NULL AND "lunarDay" IS NOT NULL AND "lunarMonth" BETWEEN 1 AND 12 AND "lunarDay" BETWEEN 1 AND 30 AND "solarMonth" IS NULL AND "solarDay" IS NULL));
ALTER TABLE "bday_contact" ADD CONSTRAINT "contact_birth_year_valid" CHECK ("birthYear" IS NULL OR ("birthYear" BETWEEN 1 AND 9999 AND ("birthdayType" = 'SOLAR' OR "birthYear" BETWEEN 1900 AND 2100)));
ALTER TABLE "bday_contact" ADD CONSTRAINT "contact_solar_date_valid" CHECK (CASE WHEN "birthdayType" = 'SOLAR' AND "solarMonth" BETWEEN 1 AND 12 AND ("birthYear" IS NULL OR "birthYear" BETWEEN 1 AND 9999) THEN "solarDay" <= EXTRACT(DAY FROM (make_date(COALESCE("birthYear",2000),"solarMonth",1) + INTERVAL '1 month - 1 day')) ELSE true END);
ALTER TABLE "bday_contact" ADD CONSTRAINT "contact_policies_valid" CHECK ("leapDayPolicy" IN ('FEB28','MAR1') AND "lunarLeapPolicy" IN ('REGULAR','SKIP'));
ALTER TABLE "bday_tag" ADD CONSTRAINT "tag_color_valid" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE "bday_tag" ADD CONSTRAINT "tag_name_nonempty" CHECK (length(trim("name")) BETWEEN 1 AND 40);
ALTER TABLE "bday_reminder_preference" ADD CONSTRAINT "preference_days_valid" CHECK (cardinality("daysBefore") BETWEEN 1 AND 12 AND 0 <= ALL("daysBefore") AND 45 >= ALL("daysBefore"));
ALTER TABLE "bday_reminder_preference" ADD CONSTRAINT "preference_time_valid" CHECK ("sendTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "bday_contact_reminder" ADD CONSTRAINT "contact_reminder_days_valid" CHECK (cardinality("daysBefore") BETWEEN 1 AND 12 AND 0 <= ALL("daysBefore") AND 45 >= ALL("daysBefore"));
ALTER TABLE "bday_contact_reminder" ADD CONSTRAINT "contact_reminder_time_valid" CHECK ("sendTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "bday_gift" ADD CONSTRAINT "gift_budget_valid" CHECK ("budget" IS NULL OR "budget" >= 0);
ALTER TABLE "bday_email_queue" ADD CONSTRAINT "queue_attempts_valid" CHECK ("attemptCount" BETWEEN 0 AND 5);
