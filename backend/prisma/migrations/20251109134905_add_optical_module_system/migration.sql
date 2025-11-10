-- CreateEnum
CREATE TYPE "PhysicalStatus" AS ENUM ('EMPTY', 'MODULE_ONLY', 'CONNECTED');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('IN_STOCK', 'INSTALLED', 'RESERVED', 'FAULTY', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PURCHASE', 'INSTALL', 'UNINSTALL', 'TRANSFER', 'REPAIR', 'RETURN', 'SCRAP');

-- AlterTable
ALTER TABLE "Port" ADD COLUMN     "physicalStatus" "PhysicalStatus" NOT NULL DEFAULT 'EMPTY';

-- CreateTable
CREATE TABLE "OpticalModule" (
    "id" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "moduleType" TEXT NOT NULL,
    "wavelength" TEXT,
    "distance" TEXT,
    "ddmSupport" BOOLEAN NOT NULL DEFAULT false,
    "supplier" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "price" DOUBLE PRECISION,
    "warrantyExpiry" TIMESTAMP(3),
    "status" "ModuleStatus" NOT NULL DEFAULT 'IN_STOCK',
    "currentPortId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpticalModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleMovement" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "fromPortId" TEXT,
    "toPortId" TEXT,
    "operator" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpticalModule_serialNo_key" ON "OpticalModule"("serialNo");

-- CreateIndex
CREATE UNIQUE INDEX "OpticalModule_currentPortId_key" ON "OpticalModule"("currentPortId");

-- CreateIndex
CREATE INDEX "OpticalModule_status_idx" ON "OpticalModule"("status");

-- CreateIndex
CREATE INDEX "OpticalModule_moduleType_idx" ON "OpticalModule"("moduleType");

-- CreateIndex
CREATE INDEX "OpticalModule_currentPortId_idx" ON "OpticalModule"("currentPortId");

-- CreateIndex
CREATE INDEX "ModuleMovement_moduleId_idx" ON "ModuleMovement"("moduleId");

-- CreateIndex
CREATE INDEX "ModuleMovement_createdAt_idx" ON "ModuleMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "OpticalModule" ADD CONSTRAINT "OpticalModule_currentPortId_fkey" FOREIGN KEY ("currentPortId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleMovement" ADD CONSTRAINT "ModuleMovement_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "OpticalModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
