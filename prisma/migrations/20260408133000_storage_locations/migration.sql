-- CreateTable
CREATE TABLE "StorageLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "GiftItem" ADD COLUMN "currentLocation" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StorageLocation_name_key" ON "StorageLocation"("name");

-- Seed canonical storage locations
INSERT INTO "StorageLocation" ("id", "name")
VALUES
    ('storage-location-jp-display', 'JP Display'),
    ('storage-location-nancy', 'Nancy'),
    ('storage-location-muse-storage-unit', 'Muse Storage Unit')
ON CONFLICT ("name") DO NOTHING;

-- Backfill gift locations so existing rows use an allowed location
UPDATE "GiftItem"
SET "currentLocation" = 'JP Display'
WHERE "currentLocation" IS NULL;
