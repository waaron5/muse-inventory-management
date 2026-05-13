-- Existing users already have passwords, so backfill passwordSetAt.
ALTER TABLE "User" ADD COLUMN "passwordSetAt" TIMESTAMP(3);
UPDATE "User" SET "passwordSetAt" = COALESCE("updatedAt", "createdAt", NOW());

CREATE TABLE "UserInviteToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInviteToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserInviteToken_tokenHash_key" ON "UserInviteToken"("tokenHash");
CREATE INDEX "UserInviteToken_userId_idx" ON "UserInviteToken"("userId");
CREATE INDEX "UserInviteToken_expiresAt_idx" ON "UserInviteToken"("expiresAt");

ALTER TABLE "UserInviteToken"
ADD CONSTRAINT "UserInviteToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
