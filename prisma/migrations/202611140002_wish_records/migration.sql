-- CreateTable
CREATE TABLE "bday_wish_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bday_wish_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bday_wish_record_userId_contactId_sentAt_idx" ON "bday_wish_record"("userId", "contactId", "sentAt");

-- AddForeignKey
ALTER TABLE "bday_wish_record" ADD CONSTRAINT "bday_wish_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "bday_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bday_wish_record" ADD CONSTRAINT "bday_wish_record_contactId_userId_fkey" FOREIGN KEY ("contactId", "userId") REFERENCES "bday_contact"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

