-- AlterTable
ALTER TABLE "CableEndpoint" ADD COLUMN     "panelId" TEXT;

-- CreateIndex
CREATE INDEX "CableEndpoint_panelId_idx" ON "CableEndpoint"("panelId");

-- AddForeignKey
ALTER TABLE "CableEndpoint" ADD CONSTRAINT "CableEndpoint_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
