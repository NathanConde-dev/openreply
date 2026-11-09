-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('INSTAGRAM_LOGIN', 'FACEBOOK_LOGIN');

-- AlterTable
ALTER TABLE "InstagramAccount" ADD COLUMN "authProvider" "AuthProvider" NOT NULL DEFAULT 'INSTAGRAM_LOGIN',
ADD COLUMN "pageId" TEXT,
ADD COLUMN "pageAccessToken" TEXT;
