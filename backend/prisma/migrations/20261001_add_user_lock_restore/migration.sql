-- AlterTable: Add locked columns to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMPTZ(6);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lockedBy" UUID;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lockReason" TEXT;

-- CreateTable: user_account_actions
CREATE TABLE IF NOT EXISTS "user_account_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_account_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_account_actions_userId_idx" ON "user_account_actions"("userId");
CREATE INDEX IF NOT EXISTS "user_account_actions_adminId_idx" ON "user_account_actions"("adminId");
CREATE INDEX IF NOT EXISTS "user_account_actions_createdAt_idx" ON "user_account_actions"("createdAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_account_actions_userId_fkey'
    ) THEN
        ALTER TABLE "user_account_actions" ADD CONSTRAINT "user_account_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_account_actions_adminId_fkey'
    ) THEN
        ALTER TABLE "user_account_actions" ADD CONSTRAINT "user_account_actions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
