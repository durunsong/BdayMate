-- Additive only: existing contacts remain opted out until settings are saved.
CREATE TABLE "bday_contact_greeting" (
  "id" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "sendTime" TEXT NOT NULL DEFAULT '09:00',
  "message" TEXT NOT NULL,
  CONSTRAINT "bday_contact_greeting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bday_contact_greeting_time_check" CHECK ("sendTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT "bday_contact_greeting_message_check" CHECK (char_length(btrim("message")) BETWEEN 1 AND 3000),
  CONSTRAINT "bday_contact_greeting_contactId_userId_fkey" FOREIGN KEY ("contactId", "userId") REFERENCES "bday_contact"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "bday_contact_greeting_contactId_key" ON "bday_contact_greeting"("contactId");
CREATE UNIQUE INDEX "bday_contact_greeting_contactId_userId_key" ON "bday_contact_greeting"("contactId", "userId");
