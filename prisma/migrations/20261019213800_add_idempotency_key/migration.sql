-- AlterTable
ALTER TABLE "lists" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "lists_userId_idempotencyKey_key" ON "lists"("userId", "idempotencyKey");
