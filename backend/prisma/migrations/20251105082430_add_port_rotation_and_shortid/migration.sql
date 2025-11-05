/*
  Warnings:

  - A unique constraint covering the columns `[shortId]` on the table `Port` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Port" ADD COLUMN     "rotation" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "shortId" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Port_shortId_key" ON "Port"("shortId");
