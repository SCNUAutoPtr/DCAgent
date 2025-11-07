/*
  Warnings:

  - A unique constraint covering the columns `[shortId]` on the table `CableEndpoint` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'CABLE_ENDPOINT';

-- AlterTable
ALTER TABLE "CableEndpoint" ADD COLUMN     "shortId" INTEGER,
ALTER COLUMN "portId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CableEndpoint_shortId_key" ON "CableEndpoint"("shortId");
