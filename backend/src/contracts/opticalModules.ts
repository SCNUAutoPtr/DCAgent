import { z } from 'zod';
import { MODULE_STATUSES, TRANSCEIVER_FORMS } from './enums';
import type { ModuleStatus, MovementType, TransceiverForm } from './enums';
import { idSchema, optText, paging, searchText } from './common';

const dateish = z.coerce.date().nullish();

export const moduleListSchema = z.object({
  status: z.enum(MODULE_STATUSES).optional(),
  moduleType: z.enum(TRANSCEIVER_FORMS).optional(),
  search: searchText,
  ...paging,
});
export const moduleBySerialSchema = z.object({ serialNo: z.string().trim().min(1).max(200) });
export const moduleCreateSchema = z.object({
  serialNo: z.string().trim().min(1).max(200),
  model: z.string().trim().min(1).max(200),
  vendor: z.string().trim().min(1).max(200),
  moduleType: z.enum(TRANSCEIVER_FORMS),
  wavelength: optText(50),
  distance: optText(50),
  ddmSupport: z.boolean().default(false),
  supplier: optText(200),
  purchaseDate: dateish,
  price: z.number().nonnegative().nullish(),
  warrantyExpiry: dateish,
  notes: optText(),
  operator: optText(100),
});
export const moduleUpdateSchema = z.object({
  id: idSchema,
  model: z.string().trim().min(1).max(200).optional(),
  vendor: z.string().trim().min(1).max(200).optional(),
  moduleType: z.enum(TRANSCEIVER_FORMS).optional(),
  wavelength: optText(50).optional(),
  distance: optText(50).optional(),
  ddmSupport: z.boolean().optional(),
  supplier: optText(200).optional(),
  purchaseDate: dateish,
  price: z.number().nonnegative().nullish(),
  warrantyExpiry: dateish,
  /** only IN_STOCK, RESERVED and FAULTY can be set directly */
  status: z.enum(['IN_STOCK', 'RESERVED', 'FAULTY']).optional(),
  notes: optText().optional(),
});
const op = { operator: optText(100), notes: optText() };
export const moduleInstallSchema = z.object({ id: idSchema, portId: idSchema, ...op });
export const moduleUninstallSchema = z.object({ id: idSchema, ...op });
export const moduleTransferSchema = z.object({ id: idSchema, toPortId: idSchema, ...op });
export const moduleScrapSchema = z.object({ id: idSchema, ...op });

export { MODULE_FITS } from './moduleFits';

export interface ModuleDto {
  id: string;
  serialNo: string;
  model: string;
  vendor: string;
  moduleType: TransceiverForm;
  wavelength: string | null;
  distance: string | null;
  ddmSupport: boolean;
  supplier: string | null;
  purchaseDate: string | null;
  price: number | null;
  warrantyExpiry: string | null;
  status: ModuleStatus;
  currentPortId: string | null;
  currentPort: { id: string; number: string; panelId: string; panelName: string; deviceId: string; deviceName: string } | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleMovementDto {
  id: string;
  movementType: MovementType;
  fromPortId: string | null;
  toPortId: string | null;
  fromPort: string | null;
  toPort: string | null;
  operator: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ModuleStatistics {
  total: number;
  byStatus: Record<ModuleStatus, number>;
  byType: Record<TransceiverForm, number>;
}
