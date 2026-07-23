-- Preserve a client message intent across Socket acknowledgement loss and REST fallback.
ALTER TABLE "Message" ADD COLUMN "clientMessageId" UUID;

CREATE UNIQUE INDEX "Message_senderId_clientMessageId_key"
ON "Message"("senderId", "clientMessageId");
