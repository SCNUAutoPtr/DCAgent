-- CreateEnum
CREATE TYPE "WorkstationStatus" AS ENUM ('ONLINE', 'OFFLINE', 'IN_USE', 'IDLE', 'MAINTENANCE', 'FAULTY');

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'WORKSTATION';

-- AlterTable
ALTER TABLE "Cabinet" ADD COLUMN     "floorPlanPosition" JSONB,
ADD COLUMN     "floorPlanSize" JSONB;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "floorPlanHeight" DOUBLE PRECISION,
ADD COLUMN     "floorPlanWidth" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Workstation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "roomId" TEXT NOT NULL,
    "cpu" TEXT,
    "memory" TEXT,
    "storage" TEXT,
    "gpu" TEXT,
    "os" TEXT,
    "status" "WorkstationStatus" NOT NULL DEFAULT 'OFFLINE',
    "assignedTo" TEXT,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "floorPlanPosition" JSONB,
    "floorPlanSize" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workstation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workstation_code_key" ON "Workstation"("code");

-- CreateIndex
CREATE INDEX "Workstation_roomId_idx" ON "Workstation"("roomId");

-- CreateIndex
CREATE INDEX "Workstation_status_idx" ON "Workstation"("status");

-- AddForeignKey
ALTER TABLE "Workstation" ADD CONSTRAINT "Workstation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
