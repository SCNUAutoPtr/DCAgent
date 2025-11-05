/*
  Warnings:

  - You are about to drop the column `height` on the `Panel` table. All the data in the column will be lost.
  - You are about to drop the column `positionX` on the `Panel` table. All the data in the column will be lost.
  - You are about to drop the column `positionY` on the `Panel` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `Panel` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `Port` table. All the data in the column will be lost.
  - You are about to drop the column `positionX` on the `Port` table. All the data in the column will be lost.
  - You are about to drop the column `positionY` on the `Port` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `Port` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Panel" DROP COLUMN "height",
DROP COLUMN "positionX",
DROP COLUMN "positionY",
DROP COLUMN "width",
ADD COLUMN     "position" JSONB,
ADD COLUMN     "size" JSONB;

-- AlterTable
ALTER TABLE "Port" DROP COLUMN "height",
DROP COLUMN "positionX",
DROP COLUMN "positionY",
DROP COLUMN "width",
ADD COLUMN     "position" JSONB,
ADD COLUMN     "size" JSONB;
