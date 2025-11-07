-- CreateTable
CREATE TABLE "GlobalShortIdSequence" (
    "id" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalShortIdSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalShortIdAllocation" (
    "id" TEXT NOT NULL,
    "shortId" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalShortIdAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalShortIdAllocation_shortId_key" ON "GlobalShortIdAllocation"("shortId");

-- CreateIndex
CREATE INDEX "GlobalShortIdAllocation_entityType_idx" ON "GlobalShortIdAllocation"("entityType");

-- CreateIndex
CREATE INDEX "GlobalShortIdAllocation_entityId_idx" ON "GlobalShortIdAllocation"("entityId");
