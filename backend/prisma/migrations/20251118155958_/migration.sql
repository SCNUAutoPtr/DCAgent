/*
  Warnings:

  - You are about to drop the `GlobalShortIdAllocation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GlobalShortIdSequence` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "IpStatus" AS ENUM ('FREE', 'ALLOCATED', 'RESERVED', 'BLOCKED');

-- DropTable
DROP TABLE "GlobalShortIdAllocation";

-- DropTable
DROP TABLE "GlobalShortIdSequence";

-- CreateTable
CREATE TABLE "IpSubnet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "cidr" INTEGER NOT NULL,
    "gateway" TEXT,
    "vlan" TEXT,
    "dnsServers" JSONB,
    "description" TEXT,
    "roomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpSubnet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpAddress" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "subnetId" TEXT NOT NULL,
    "status" "IpStatus" NOT NULL DEFAULT 'FREE',
    "portId" TEXT,
    "deviceId" TEXT,
    "hostname" TEXT,
    "macAddress" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IpSubnet_roomId_idx" ON "IpSubnet"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "IpAddress_address_key" ON "IpAddress"("address");

-- CreateIndex
CREATE UNIQUE INDEX "IpAddress_portId_key" ON "IpAddress"("portId");

-- CreateIndex
CREATE INDEX "IpAddress_subnetId_idx" ON "IpAddress"("subnetId");

-- CreateIndex
CREATE INDEX "IpAddress_status_idx" ON "IpAddress"("status");

-- CreateIndex
CREATE INDEX "IpAddress_portId_idx" ON "IpAddress"("portId");

-- CreateIndex
CREATE INDEX "IpAddress_deviceId_idx" ON "IpAddress"("deviceId");

-- AddForeignKey
ALTER TABLE "IpSubnet" ADD CONSTRAINT "IpSubnet_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_subnetId_fkey" FOREIGN KEY ("subnetId") REFERENCES "IpSubnet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
