import { z } from 'zod';
import type { KeepReason } from './panelTemplates';
import { PANEL_FACES, PANEL_TYPES, PORT_ADMIN_STATES, PORT_TYPES } from './enums';
import type { CableEnd, CableMedium, IpStatus, ModuleStatus, PanelFace, PanelType, PortAdminState, PortType } from './enums';
import { idSchema, optText, shortIdSchema } from './common';
import type { LabelRef, PathNode } from './common';
import { rotationSchema } from './hierarchy';

const mm = z.number().min(0).max(10_000);
const positiveMm = z.number().positive().max(10_000);

// ---------- panels ----------

export const panelListSchema = z.object({
  deviceId: idSchema.optional(),
  cabinetId: idSchema.optional(),
  roomId: idSchema.optional(),
  type: z.enum(PANEL_TYPES).optional(),
  /** include ports (with derived state) for each panel, avoiding one request per panel */
  includePorts: z.boolean().default(false),
});

export const panelCreateSchema = z
  .object({
    deviceId: idSchema,
    name: z.string().trim().min(1).max(100),
    type: z.enum(PANEL_TYPES),
    face: z.enum(PANEL_FACES).default('FRONT'),
    notes: optText(),
    widthMm: positiveMm.nullish(),
    heightMm: positiveMm.nullish(),
    labelShortId: shortIdSchema.optional(),
  })
  .refine((v) => (v.widthMm == null) === (v.heightMm == null), { message: 'widthMm and heightMm go together' });

export const panelUpdateSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(100).optional(),
    type: z.enum(PANEL_TYPES).optional(),
    face: z.enum(PANEL_FACES).optional(),
    notes: optText().optional(),
    widthMm: positiveMm.nullish(),
    heightMm: positiveMm.nullish(),
  })
  .refine((v) => (v.widthMm == null) === (v.heightMm == null), { message: 'widthMm and heightMm go together' });

export const panelDeleteSchema = z.object({ id: idSchema, force: z.boolean().default(false) });

export interface PanelDto {
  id: string;
  name: string;
  type: PanelType;
  face: PanelFace;
  notes: string | null;
  deviceId: string;
  deviceName: string;
  templateId: string | null;
  templateRevision: number | null;
  /** template has a newer revision than the one applied */
  templateOutdated: boolean;
  widthMm: number | null;
  heightMm: number | null;
  label: LabelRef | null;
  portCount: number;
  connectedCount: number;
  parkedCount: number;
  ports?: PortDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PanelDetailDto extends PanelDto {
  ports: PortDto[];
  path: PathNode[];
}

// ---------- ports ----------

const geometry = {
  xMm: mm.nullish(),
  yMm: mm.nullish(),
  wMm: positiveMm.nullish(),
  hMm: positiveMm.nullish(),
};
const geometryAllOrNone = (v: { xMm?: number | null; yMm?: number | null; wMm?: number | null; hMm?: number | null }) => {
  const n = [v.xMm, v.yMm, v.wMm, v.hMm].filter((x) => x == null).length;
  return n === 0 || n === 4;
};

export const portListSchema = z.object({
  panelId: idSchema,
  filter: z
    .object({
      adminState: z.enum(PORT_ADMIN_STATES).optional(),
      connected: z.boolean().optional(),
      portType: z.enum(PORT_TYPES).optional(),
    })
    .default({}),
});

export const portCreateSchema = z
  .object({
    panelId: idSchema,
    number: z.string().trim().min(1).max(50),
    sortIndex: z.number().int().min(0).optional(),
    ifName: optText(100),
    portType: z.enum(PORT_TYPES),
    label: optText(100),
    adminState: z.enum(PORT_ADMIN_STATES).default('NORMAL'),
    notes: optText(),
    ...geometry,
    rotation: rotationSchema.default(0),
  })
  .refine(geometryAllOrNone, { message: 'xMm/yMm/wMm/hMm go together' });

export const portCreateBulkSchema = z.object({
  panelId: idSchema,
  count: z.number().int().min(1).max(256),
  prefix: z.string().max(20).default(''),
  startNumber: z.number().int().min(0).default(1),
  portType: z.enum(PORT_TYPES),
  /** e.g. "GigabitEthernet0/0/{n}" */
  ifNamePattern: z.string().max(100).optional(),
});

export const portUpdateSchema = z
  .object({
    id: idSchema,
    number: z.string().trim().min(1).max(50).optional(),
    sortIndex: z.number().int().min(0).optional(),
    ifName: optText(100).optional(),
    portType: z.enum(PORT_TYPES).optional(),
    label: optText(100).optional(),
    notes: optText().optional(),
    ...geometry,
    rotation: rotationSchema.optional(),
  })
  .refine(geometryAllOrNone, { message: 'xMm/yMm/wMm/hMm go together' });

export const portSetAdminStateSchema = z.object({ id: idSchema, adminState: z.enum(PORT_ADMIN_STATES) });
export const portDeleteSchema = z.object({ id: idSchema, force: z.boolean().default(false) });

export interface PortEndpointRef {
  id: string;
  cableId: string;
  end: CableEnd;
  label: LabelRef | null;
}

export interface PortDto {
  id: string;
  panelId: string;
  number: string;
  sortIndex: number;
  ifName: string | null;
  portType: PortType;
  label: string | null;
  adminState: PortAdminState;
  notes: string | null;
  xMm: number | null;
  yMm: number | null;
  wMm: number | null;
  hMm: number | null;
  rotation: number;
  /** derived: a cable end is plugged in */
  connected: boolean;
  /** derived: an optical module sits in the port */
  hasModule: boolean;
  endpoint: PortEndpointRef | null;
}

export interface PortPeer {
  endpointId: string;
  end: CableEnd;
  label: LabelRef | null;
  portId: string | null;
  parkedPanelId: string | null;
  path: PathNode[];
}

export interface PortDetailDto extends PortDto {
  path: PathNode[];
  cable: { id: string; medium: CableMedium; label: string | null; color: string | null; lengthM: number | null } | null;
  peer: PortPeer | null;
  opticalModule: { id: string; serialNo: string; model: string; vendor: string; status: ModuleStatus } | null;
  ipAddress: { id: string; address: string; status: IpStatus; subnetId: string } | null;
  attachedWorkstations: { id: string; name: string; code: string | null }[];
}

export interface PortDependents {
  portId: string;
  number: string;
  reasons: KeepReason[];
}
