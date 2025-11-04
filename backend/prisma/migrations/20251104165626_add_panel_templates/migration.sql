-- AlterTable
ALTER TABLE "Panel" ADD COLUMN     "isCustomized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "PanelTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PanelType" NOT NULL,
    "portCount" INTEGER NOT NULL,
    "description" TEXT,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 482.6,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 44.45,
    "layoutConfig" JSONB,
    "portDefinitions" JSONB NOT NULL,
    "backgroundColor" TEXT,
    "image" TEXT,
    "svgPath" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanelTemplate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Panel" ADD CONSTRAINT "Panel_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PanelTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
