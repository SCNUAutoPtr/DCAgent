-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('SERVER', 'SWITCH', 'ROUTER', 'FIREWALL', 'STORAGE', 'PDU', 'OTHER');

-- CreateEnum
CREATE TYPE "PanelType" AS ENUM ('NETWORK', 'POWER', 'CONSOLE', 'USB', 'OTHER');

-- CreateEnum
CREATE TYPE "PanelFace" AS ENUM ('FRONT', 'REAR');

-- CreateEnum
CREATE TYPE "PortType" AS ENUM ('RJ45', 'SFP', 'SFP_PLUS', 'SFP28', 'QSFP', 'QSFP28', 'QSFP_DD', 'CONSOLE', 'USB', 'POWER', 'OTHER');

-- CreateEnum
CREATE TYPE "PortAdminState" AS ENUM ('NORMAL', 'RESERVED', 'FAULTY');

-- CreateEnum
CREATE TYPE "CableMedium" AS ENUM ('CAT5E', 'CAT6', 'CAT6A', 'CAT7', 'FIBER_SM', 'FIBER_MM', 'DAC', 'AOC', 'POWER', 'OTHER');

-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('RJ45', 'LC', 'SC', 'MPO', 'SFP', 'SFP_PLUS', 'QSFP', 'QSFP28', 'OTHER');

-- CreateEnum
CREATE TYPE "CableEnd" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "LabelState" AS ENUM ('GENERATED', 'PRINTED', 'VOID');

-- CreateEnum
CREATE TYPE "PrintTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('IN_STOCK', 'INSTALLED', 'RESERVED', 'FAULTY', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "TransceiverForm" AS ENUM ('SFP', 'SFP_PLUS', 'SFP28', 'QSFP', 'QSFP28', 'QSFP_DD', 'OTHER');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PURCHASE', 'INSTALL', 'UNINSTALL', 'TRANSFER', 'REPAIR', 'RETURN', 'SCRAP');

-- CreateEnum
CREATE TYPE "IpStatus" AS ENUM ('ALLOCATED', 'RESERVED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "WorkstationAdminState" AS ENUM ('ACTIVE', 'MAINTENANCE', 'FAULTY', 'RETIRED');

-- CreateEnum
CREATE TYPE "UnmatchedSource" AS ENUM ('WORKSTATION_ATTACH', 'PORT_OBSERVATION');

-- CreateTable
CREATE TABLE "DataCenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor" TEXT,
    "notes" TEXT,
    "dataCenterId" TEXT NOT NULL,
    "widthM" DOUBLE PRECISION,
    "depthM" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cabinet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "positionCode" TEXT,
    "heightU" INTEGER NOT NULL DEFAULT 42,
    "notes" TEXT,
    "roomId" TEXT NOT NULL,
    "fpX" DOUBLE PRECISION,
    "fpY" DOUBLE PRECISION,
    "fpW" DOUBLE PRECISION,
    "fpD" DOUBLE PRECISION,
    "fpRotation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cabinet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceModel" (
    "id" TEXT NOT NULL,
    "vendor" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL,
    "uHeight" INTEGER,
    "depthMm" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "deviceModelId" TEXT,
    "serialNo" TEXT,
    "sysname" TEXT,
    "cabinetId" TEXT,
    "roomId" TEXT,
    "uPosition" INTEGER,
    "uHeight" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Panel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PanelType" NOT NULL,
    "face" "PanelFace" NOT NULL DEFAULT 'FRONT',
    "notes" TEXT,
    "deviceId" TEXT NOT NULL,
    "templateId" TEXT,
    "templateRevision" INTEGER,
    "widthMm" DOUBLE PRECISION,
    "heightMm" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Panel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Port" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL,
    "ifName" TEXT,
    "portType" "PortType" NOT NULL,
    "label" TEXT,
    "adminState" "PortAdminState" NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "xMm" DOUBLE PRECISION,
    "yMm" DOUBLE PRECISION,
    "wMm" DOUBLE PRECISION,
    "hMm" DOUBLE PRECISION,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Port_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PanelType" NOT NULL,
    "face" "PanelFace" NOT NULL DEFAULT 'FRONT',
    "deviceModelId" TEXT,
    "widthMm" DOUBLE PRECISION NOT NULL DEFAULT 482.6,
    "heightMm" DOUBLE PRECISION NOT NULL DEFAULT 44.45,
    "generator" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanelTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelTemplatePort" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL,
    "portType" "PortType" NOT NULL,
    "ifName" TEXT,
    "xMm" DOUBLE PRECISION NOT NULL,
    "yMm" DOUBLE PRECISION NOT NULL,
    "wMm" DOUBLE PRECISION NOT NULL,
    "hMm" DOUBLE PRECISION NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PanelTemplatePort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cable" (
    "id" TEXT NOT NULL,
    "medium" "CableMedium" NOT NULL,
    "label" TEXT,
    "lengthM" DOUBLE PRECISION,
    "color" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CableEndpoint" (
    "id" TEXT NOT NULL,
    "cableId" TEXT NOT NULL,
    "end" "CableEnd" NOT NULL,
    "connector" "ConnectorType",
    "portId" TEXT,
    "parkedPanelId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CableEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Label" (
    "shortId" INTEGER NOT NULL,
    "state" "LabelState" NOT NULL DEFAULT 'GENERATED',
    "printTaskId" TEXT,
    "printedAt" TIMESTAMP(3),
    "batchNo" TEXT,
    "notes" TEXT,
    "firstBoundAt" TIMESTAMP(3),
    "boundAt" TIMESTAMP(3),
    "roomId" TEXT,
    "cabinetId" TEXT,
    "panelId" TEXT,
    "cableEndpointId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("shortId")
);

-- CreateTable
CREATE TABLE "PrintTask" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PrintTaskStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpticalModule" (
    "id" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "moduleType" "TransceiverForm" NOT NULL,
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
    "fromPortPath" TEXT,
    "toPortId" TEXT,
    "toPortPath" TEXT,
    "operator" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpSubnet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "network" INET NOT NULL,
    "prefixLen" INTEGER NOT NULL,
    "gateway" INET,
    "vlan" INTEGER,
    "dnsServers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "roomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpSubnet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpAddress" (
    "id" TEXT NOT NULL,
    "subnetId" TEXT NOT NULL,
    "address" INET NOT NULL,
    "status" "IpStatus" NOT NULL DEFAULT 'ALLOCATED',
    "portId" TEXT,
    "deviceId" TEXT,
    "workstationId" TEXT,
    "hostname" TEXT,
    "macAddress" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpAddress_pkey" PRIMARY KEY ("id")
);

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
    "adminState" "WorkstationAdminState" NOT NULL DEFAULT 'ACTIVE',
    "assignedTo" TEXT,
    "fpX" DOUBLE PRECISION,
    "fpY" DOUBLE PRECISION,
    "fpW" DOUBLE PRECISION,
    "fpD" DOUBLE PRECISION,
    "notes" TEXT,
    "attachedPortId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workstation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortObservation" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "portId" TEXT,
    "ifName" TEXT NOT NULL,
    "phy" TEXT,
    "inUtilPercent" DOUBLE PRECISION,
    "outUtilPercent" DOUBLE PRECISION,
    "inErrors" INTEGER,
    "outErrors" INTEGER,
    "rxPowerDbm" DOUBLE PRECISION,
    "txPowerDbm" DOUBLE PRECISION,
    "rxLowAlarmDbm" DOUBLE PRECISION,
    "rxLowWarnDbm" DOUBLE PRECISION,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationUnmatched" (
    "id" TEXT NOT NULL,
    "source" "UnmatchedSource" NOT NULL,
    "sysname" TEXT NOT NULL,
    "ifName" TEXT,
    "workstationId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservationUnmatched_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataCenter_name_key" ON "DataCenter"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Room_dataCenterId_name_key" ON "Room"("dataCenterId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Cabinet_roomId_name_key" ON "Cabinet"("roomId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceModel_vendor_name_key" ON "DeviceModel"("vendor", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Device_serialNo_key" ON "Device"("serialNo");

-- CreateIndex
CREATE UNIQUE INDEX "Device_sysname_key" ON "Device"("sysname");

-- CreateIndex
CREATE UNIQUE INDEX "Device_cabinetId_name_key" ON "Device"("cabinetId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Device_roomId_name_key" ON "Device"("roomId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Panel_deviceId_name_key" ON "Panel"("deviceId", "name");

-- CreateIndex
CREATE INDEX "Port_panelId_sortIndex_idx" ON "Port"("panelId", "sortIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Port_panelId_number_key" ON "Port"("panelId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Port_panelId_ifName_key" ON "Port"("panelId", "ifName");

-- CreateIndex
CREATE UNIQUE INDEX "PanelTemplate_name_key" ON "PanelTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PanelTemplatePort_templateId_number_key" ON "PanelTemplatePort"("templateId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "CableEndpoint_portId_key" ON "CableEndpoint"("portId");

-- CreateIndex
CREATE INDEX "CableEndpoint_parkedPanelId_idx" ON "CableEndpoint"("parkedPanelId");

-- CreateIndex
CREATE UNIQUE INDEX "CableEndpoint_cableId_end_key" ON "CableEndpoint"("cableId", "end");

-- CreateIndex
CREATE UNIQUE INDEX "Label_roomId_key" ON "Label"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "Label_cabinetId_key" ON "Label"("cabinetId");

-- CreateIndex
CREATE UNIQUE INDEX "Label_panelId_key" ON "Label"("panelId");

-- CreateIndex
CREATE UNIQUE INDEX "Label_cableEndpointId_key" ON "Label"("cableEndpointId");

-- CreateIndex
CREATE INDEX "Label_state_idx" ON "Label"("state");

-- CreateIndex
CREATE UNIQUE INDEX "OpticalModule_serialNo_key" ON "OpticalModule"("serialNo");

-- CreateIndex
CREATE UNIQUE INDEX "OpticalModule_currentPortId_key" ON "OpticalModule"("currentPortId");

-- CreateIndex
CREATE INDEX "OpticalModule_status_idx" ON "OpticalModule"("status");

-- CreateIndex
CREATE INDEX "OpticalModule_moduleType_idx" ON "OpticalModule"("moduleType");

-- CreateIndex
CREATE INDEX "ModuleMovement_moduleId_idx" ON "ModuleMovement"("moduleId");

-- CreateIndex
CREATE INDEX "ModuleMovement_createdAt_idx" ON "ModuleMovement"("createdAt");

-- CreateIndex
CREATE INDEX "IpSubnet_roomId_idx" ON "IpSubnet"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "IpSubnet_network_prefixLen_key" ON "IpSubnet"("network", "prefixLen");

-- CreateIndex
CREATE UNIQUE INDEX "IpAddress_portId_key" ON "IpAddress"("portId");

-- CreateIndex
CREATE UNIQUE INDEX "IpAddress_workstationId_key" ON "IpAddress"("workstationId");

-- CreateIndex
CREATE INDEX "IpAddress_status_idx" ON "IpAddress"("status");

-- CreateIndex
CREATE INDEX "IpAddress_deviceId_idx" ON "IpAddress"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "IpAddress_subnetId_address_key" ON "IpAddress"("subnetId", "address");

-- CreateIndex
CREATE UNIQUE INDEX "Workstation_code_key" ON "Workstation"("code");

-- CreateIndex
CREATE INDEX "Workstation_attachedPortId_idx" ON "Workstation"("attachedPortId");

-- CreateIndex
CREATE UNIQUE INDEX "Workstation_roomId_name_key" ON "Workstation"("roomId", "name");

-- CreateIndex
CREATE INDEX "PortObservation_deviceId_ifName_collectedAt_idx" ON "PortObservation"("deviceId", "ifName", "collectedAt");

-- CreateIndex
CREATE INDEX "PortObservation_portId_idx" ON "PortObservation"("portId");

-- CreateIndex
CREATE INDEX "ObservationUnmatched_source_idx" ON "ObservationUnmatched"("source");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_dataCenterId_fkey" FOREIGN KEY ("dataCenterId") REFERENCES "DataCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cabinet" ADD CONSTRAINT "Cabinet_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "DeviceModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "Cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Panel" ADD CONSTRAINT "Panel_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Panel" ADD CONSTRAINT "Panel_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PanelTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Port" ADD CONSTRAINT "Port_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelTemplate" ADD CONSTRAINT "PanelTemplate_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "DeviceModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelTemplatePort" ADD CONSTRAINT "PanelTemplatePort_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PanelTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableEndpoint" ADD CONSTRAINT "CableEndpoint_cableId_fkey" FOREIGN KEY ("cableId") REFERENCES "Cable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableEndpoint" ADD CONSTRAINT "CableEndpoint_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CableEndpoint" ADD CONSTRAINT "CableEndpoint_parkedPanelId_fkey" FOREIGN KEY ("parkedPanelId") REFERENCES "Panel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_printTaskId_fkey" FOREIGN KEY ("printTaskId") REFERENCES "PrintTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "Cabinet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_cableEndpointId_fkey" FOREIGN KEY ("cableEndpointId") REFERENCES "CableEndpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpticalModule" ADD CONSTRAINT "OpticalModule_currentPortId_fkey" FOREIGN KEY ("currentPortId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleMovement" ADD CONSTRAINT "ModuleMovement_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "OpticalModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleMovement" ADD CONSTRAINT "ModuleMovement_fromPortId_fkey" FOREIGN KEY ("fromPortId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleMovement" ADD CONSTRAINT "ModuleMovement_toPortId_fkey" FOREIGN KEY ("toPortId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpSubnet" ADD CONSTRAINT "IpSubnet_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_subnetId_fkey" FOREIGN KEY ("subnetId") REFERENCES "IpSubnet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workstation" ADD CONSTRAINT "Workstation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workstation" ADD CONSTRAINT "Workstation_attachedPortId_fkey" FOREIGN KEY ("attachedPortId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortObservation" ADD CONSTRAINT "PortObservation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortObservation" ADD CONSTRAINT "PortObservation_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationUnmatched" ADD CONSTRAINT "ObservationUnmatched_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- native constraints
-- Prisma does not model the rules below; they are hand-written and kept in this file.
-- Error mapping in src/http/errors.ts relies on the constraint names and the message prefixes
-- (LABEL_REQUIRED, IP_OUT_OF_SUBNET).

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Natural order for names that carry numbers ("S110-9" < "S110-10" < "S110-100"), so every
-- ORDER BY name (including paginated lists) sorts the way people read. ICU collations do not
-- depend on the C library of the image, so the order (and the btree indexes) stay the same on
-- glibc and musl. Equality stays deterministic, unique constraints keep their meaning.
CREATE COLLATION IF NOT EXISTS "natural" (provider = icu, locale = 'und-u-kn-true');
ALTER TABLE "Room" ALTER COLUMN "name" TYPE TEXT COLLATE "natural";
ALTER TABLE "Cabinet" ALTER COLUMN "name" TYPE TEXT COLLATE "natural";
ALTER TABLE "DeviceModel" ALTER COLUMN "name" TYPE TEXT COLLATE "natural";
ALTER TABLE "Device" ALTER COLUMN "name" TYPE TEXT COLLATE "natural";
ALTER TABLE "Panel" ALTER COLUMN "name" TYPE TEXT COLLATE "natural";
ALTER TABLE "Port" ALTER COLUMN "number" TYPE TEXT COLLATE "natural";
ALTER TABLE "PanelTemplate" ALTER COLUMN "name" TYPE TEXT COLLATE "natural";
ALTER TABLE "IpSubnet" ALTER COLUMN "name" TYPE TEXT COLLATE "natural";
ALTER TABLE "Workstation" ALTER COLUMN "name" TYPE TEXT COLLATE "natural";

-- Cabinet
ALTER TABLE "Cabinet"
  ADD CONSTRAINT "cabinet_fp_xy" CHECK (("fpX" IS NULL) = ("fpY" IS NULL)),
  ADD CONSTRAINT "cabinet_fp_wd" CHECK (("fpW" IS NULL) = ("fpD" IS NULL)),
  ADD CONSTRAINT "cabinet_fp_size_positive" CHECK ("fpW" IS NULL OR ("fpW" > 0 AND "fpD" > 0)),
  ADD CONSTRAINT "cabinet_fp_rotation" CHECK ("fpRotation" IN (0, 90, 180, 270)),
  ADD CONSTRAINT "cabinet_height" CHECK ("heightU" BETWEEN 1 AND 60);

-- Room
ALTER TABLE "Room"
  ADD CONSTRAINT "room_size_positive" CHECK (("widthM" IS NULL OR "widthM" > 0) AND ("depthM" IS NULL OR "depthM" > 0));

-- DeviceModel
ALTER TABLE "DeviceModel"
  ADD CONSTRAINT "device_model_u_height" CHECK ("uHeight" IS NULL OR "uHeight" BETWEEN 1 AND 60),
  ADD CONSTRAINT "device_model_depth" CHECK ("depthMm" IS NULL OR "depthMm" > 0);

-- Device: exactly one container; U position only inside a cabinet; no overlapping U ranges.
-- uHeight NULL means "height not known": such a device occupies at least the U it sits in.
ALTER TABLE "Device"
  ADD CONSTRAINT "device_location" CHECK (num_nonnulls("cabinetId", "roomId") = 1),
  ADD CONSTRAINT "device_u_position" CHECK ("uPosition" IS NULL OR ("cabinetId" IS NOT NULL AND "uPosition" >= 1)),
  ADD CONSTRAINT "device_u_height" CHECK ("uHeight" IS NULL OR "uHeight" BETWEEN 1 AND 60),
  ADD CONSTRAINT "device_u_overlap" EXCLUDE USING gist (
    "cabinetId" WITH =,
    int4range("uPosition", "uPosition" + coalesce("uHeight", 1)) WITH &&
  ) WHERE ("uPosition" IS NOT NULL);

-- Panel
ALTER TABLE "Panel"
  ADD CONSTRAINT "panel_size" CHECK (("widthMm" IS NULL) = ("heightMm" IS NULL));

-- Port: geometry all-or-nothing, rotation in quarter turns
ALTER TABLE "Port"
  ADD CONSTRAINT "port_geometry" CHECK (num_nulls("xMm", "yMm", "wMm", "hMm") IN (0, 4)),
  ADD CONSTRAINT "port_rotation" CHECK ("rotation" IN (0, 90, 180, 270));

ALTER TABLE "PanelTemplatePort"
  ADD CONSTRAINT "template_port_rotation" CHECK ("rotation" IN (0, 90, 180, 270)),
  ADD CONSTRAINT "template_port_size" CHECK ("wMm" > 0 AND "hMm" > 0);

ALTER TABLE "PanelTemplate"
  ADD CONSTRAINT "template_revision" CHECK ("revision" >= 1);

-- CableEndpoint: plugged into a port, or parked on a panel, never both
ALTER TABLE "CableEndpoint"
  ADD CONSTRAINT "endpoint_port_or_parked" CHECK ("portId" IS NULL OR "parkedPanelId" IS NULL);

-- Label: one entity at most; void labels are never bound; bound labels remember first binding
ALTER TABLE "Label"
  ADD CONSTRAINT "label_single_entity" CHECK (num_nonnulls("roomId", "cabinetId", "panelId", "cableEndpointId") <= 1),
  ADD CONSTRAINT "label_void_unbound" CHECK ("state" <> 'VOID' OR num_nonnulls("roomId", "cabinetId", "panelId", "cableEndpointId") = 0),
  ADD CONSTRAINT "label_first_bound" CHECK (num_nonnulls("roomId", "cabinetId", "panelId", "cableEndpointId") = 0 OR "firstBoundAt" IS NOT NULL),
  ADD CONSTRAINT "label_short_id_positive" CHECK ("shortId" > 0);

-- Cabinets, panels and cable endpoints must carry a label at commit time.
CREATE FUNCTION dca_label_required() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  fk text := TG_ARGV[0];
  still_exists boolean;
  has_label boolean;
BEGIN
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE id = $1)', TG_TABLE_NAME) INTO still_exists USING NEW.id;
  IF NOT still_exists THEN
    RETURN NULL;
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM "Label" WHERE %I = $1)', fk) INTO has_label USING NEW.id;
  IF NOT has_label THEN
    RAISE EXCEPTION 'LABEL_REQUIRED: % % has no label', TG_TABLE_NAME, NEW.id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "cabinet_label_required" AFTER INSERT ON "Cabinet"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dca_label_required('cabinetId');
CREATE CONSTRAINT TRIGGER "panel_label_required" AFTER INSERT ON "Panel"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dca_label_required('panelId');
CREATE CONSTRAINT TRIGGER "endpoint_label_required" AFTER INSERT ON "CableEndpoint"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dca_label_required('cableEndpointId');

-- Taking a label away from a still-existing cabinet/panel/endpoint requires binding a new one
-- in the same transaction. A SetNull caused by deleting the entity passes (entity is gone).
CREATE FUNCTION dca_label_kept() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ok boolean;
BEGIN
  IF OLD."cabinetId" IS NOT NULL THEN
    SELECT NOT EXISTS (SELECT 1 FROM "Cabinet" WHERE id = OLD."cabinetId")
        OR EXISTS (SELECT 1 FROM "Label" WHERE "cabinetId" = OLD."cabinetId") INTO ok;
    IF NOT ok THEN RAISE EXCEPTION 'LABEL_REQUIRED: Cabinet % has no label', OLD."cabinetId"; END IF;
  END IF;
  IF OLD."panelId" IS NOT NULL THEN
    SELECT NOT EXISTS (SELECT 1 FROM "Panel" WHERE id = OLD."panelId")
        OR EXISTS (SELECT 1 FROM "Label" WHERE "panelId" = OLD."panelId") INTO ok;
    IF NOT ok THEN RAISE EXCEPTION 'LABEL_REQUIRED: Panel % has no label', OLD."panelId"; END IF;
  END IF;
  IF OLD."cableEndpointId" IS NOT NULL THEN
    SELECT NOT EXISTS (SELECT 1 FROM "CableEndpoint" WHERE id = OLD."cableEndpointId")
        OR EXISTS (SELECT 1 FROM "Label" WHERE "cableEndpointId" = OLD."cableEndpointId") INTO ok;
    IF NOT ok THEN RAISE EXCEPTION 'LABEL_REQUIRED: CableEndpoint % has no label', OLD."cableEndpointId"; END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "label_kept_on_update" AFTER UPDATE OF "cabinetId", "panelId", "cableEndpointId" ON "Label"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dca_label_kept();
CREATE CONSTRAINT TRIGGER "label_kept_on_delete" AFTER DELETE ON "Label"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dca_label_kept();

-- Optical module: INSTALLED exactly when it sits in a port
ALTER TABLE "OpticalModule"
  ADD CONSTRAINT "module_installed_port" CHECK (("status" = 'INSTALLED') = ("currentPortId" IS NOT NULL));

-- IP
ALTER TABLE "IpSubnet"
  ADD CONSTRAINT "subnet_prefix" CHECK ("prefixLen" BETWEEN 0 AND CASE family("network") WHEN 4 THEN 32 ELSE 128 END),
  ADD CONSTRAINT "subnet_network_host_bits" CHECK (
    masklen("network") = CASE family("network") WHEN 4 THEN 32 ELSE 128 END
    AND host(network(set_masklen("network", "prefixLen")))::inet = "network"
  ),
  ADD CONSTRAINT "subnet_gateway_inside" CHECK ("gateway" IS NULL OR "gateway" << set_masklen("network", "prefixLen")),
  ADD CONSTRAINT "subnet_vlan" CHECK ("vlan" IS NULL OR "vlan" BETWEEN 1 AND 4094);

ALTER TABLE "IpAddress"
  ADD CONSTRAINT "ip_single_owner" CHECK (num_nonnulls("portId", "deviceId", "workstationId") <= 1),
  ADD CONSTRAINT "ip_host_address" CHECK (masklen("address") = CASE family("address") WHEN 4 THEN 32 ELSE 128 END);

CREATE FUNCTION dca_ip_in_subnet() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  net inet;
BEGIN
  SELECT set_masklen("network", "prefixLen") INTO net FROM "IpSubnet" WHERE id = NEW."subnetId";
  IF net IS NULL OR NOT (NEW."address" << net) THEN
    RAISE EXCEPTION 'IP_OUT_OF_SUBNET: % is not inside %', NEW."address", net;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ip_in_subnet" BEFORE INSERT OR UPDATE OF "address", "subnetId" ON "IpAddress"
  FOR EACH ROW EXECUTE FUNCTION dca_ip_in_subnet();

CREATE FUNCTION dca_subnet_keeps_addresses() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "IpAddress" WHERE "subnetId" = NEW.id AND NOT ("address" << set_masklen(NEW."network", NEW."prefixLen"))) THEN
    RAISE EXCEPTION 'IP_OUT_OF_SUBNET: subnet % would leave addresses outside %/%', NEW.id, host(NEW."network"), NEW."prefixLen";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "subnet_keeps_addresses" BEFORE UPDATE OF "network", "prefixLen" ON "IpSubnet"
  FOR EACH ROW EXECUTE FUNCTION dca_subnet_keeps_addresses();

-- Workstation floor plan geometry
ALTER TABLE "Workstation"
  ADD CONSTRAINT "workstation_fp_xy" CHECK (("fpX" IS NULL) = ("fpY" IS NULL)),
  ADD CONSTRAINT "workstation_fp_wd" CHECK (("fpW" IS NULL) = ("fpD" IS NULL));
