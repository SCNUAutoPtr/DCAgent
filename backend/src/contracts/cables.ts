import { z } from 'zod';
import { CABLE_ENDS, CABLE_MEDIA, CABLE_STATES, CONNECTOR_TYPES } from './enums';
import type { CableEnd, CableMedium, CableState, ConnectorType } from './enums';
import { idSchema, optText, paging, searchText, shortIdSchema } from './common';
import type { LabelRef, PathNode } from './common';

const endInput = z
  .object({
    /** omitted: a label is allocated automatically */
    labelShortId: shortIdSchema.optional(),
    portId: idSchema.optional(),
    parkedPanelId: idSchema.optional(),
    connector: z.enum(CONNECTOR_TYPES).nullish(),
    notes: optText(),
  })
  .refine((v) => !(v.portId && v.parkedPanelId), { message: 'an end is either plugged into a port or parked on a panel' });
export type CableEndInput = z.infer<typeof endInput>;

const cableFields = {
  label: optText(200),
  lengthM: z.number().positive().max(100_000).nullish(),
  color: optText(50),
  notes: optText(),
};

export const cableCreateSchema = z
  .object({
    medium: z.enum(CABLE_MEDIA),
    ...cableFields,
    ends: z.object({ A: endInput, B: endInput }),
  })
  .refine((v) => !(v.ends.A.portId && v.ends.A.portId === v.ends.B.portId), { message: 'both ends cannot use the same port' })
  .refine((v) => !(v.ends.A.labelShortId && v.ends.A.labelShortId === v.ends.B.labelShortId), {
    message: 'both ends cannot use the same label',
  });

export const cableUpdateSchema = z.object({
  id: idSchema,
  medium: z.enum(CABLE_MEDIA).optional(),
  label: optText(200).optional(),
  lengthM: z.number().positive().max(100_000).nullish(),
  color: optText(50).optional(),
  notes: optText().optional(),
  ends: z
    .array(z.object({ end: z.enum(CABLE_ENDS), connector: z.enum(CONNECTOR_TYPES).nullish(), notes: optText().optional() }))
    .max(2)
    .optional(),
});

const endpointRef = {
  endpointId: idSchema.optional(),
  labelShortId: shortIdSchema.optional(),
};
const oneRef = (v: { endpointId?: string; labelShortId?: number }) => (v.endpointId === undefined) !== (v.labelShortId === undefined);

export const cableConnectEndSchema = z
  .object({ ...endpointRef, portId: idSchema })
  .refine(oneRef, { message: 'give exactly one of endpointId or labelShortId' });

export const cableDisconnectEndSchema = z
  .object({
    ...endpointRef,
    /** park the end on this panel; omitted: parked on the panel of the port it leaves */
    parkPanelId: idSchema.nullish(),
  })
  .refine(oneRef, { message: 'give exactly one of endpointId or labelShortId' });

export const cableDeleteSchema = z.object({
  id: idSchema,
  /** scrap: the labels of both ends become VOID; otherwise they stay unbound for manual reuse */
  voidLabels: z.boolean(),
});

export const cableListSchema = z.object({
  filter: z
    .object({
      state: z.enum(CABLE_STATES).optional(),
      medium: z.enum(CABLE_MEDIA).optional(),
      search: searchText,
    })
    .default({}),
  ...paging,
});

export const panelConnectionsSchema = z.object({ panelId: idSchema });
export const danglingByDeviceSchema = z.object({ deviceId: idSchema });

export interface EndpointDto {
  id: string;
  cableId: string;
  end: CableEnd;
  connector: ConnectorType | null;
  notes: string | null;
  label: LabelRef | null;
  portId: string | null;
  parkedPanelId: string | null;
  port: { id: string; number: string; ifName: string | null } | null;
  /** panel of the port, or the panel the end is parked on */
  panel: { id: string; name: string } | null;
  device: { id: string; name: string } | null;
  cabinet: { id: string; name: string } | null;
  room: { id: string; name: string } | null;
  path: PathNode[];
}

export interface CableDto {
  id: string;
  medium: CableMedium;
  label: string | null;
  lengthM: number | null;
  color: string | null;
  notes: string | null;
  /** derived from the ends */
  state: CableState;
  endpoints: EndpointDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PanelConnection {
  portId: string;
  portNumber: string;
  cable: { id: string; medium: CableMedium; label: string | null };
  local: EndpointDto;
  peer: EndpointDto | null;
  /** both ends are on this panel */
  loopback: boolean;
}

export interface DanglingByDevice {
  total: number;
  panels: { panelId: string; panelName: string; endpoints: EndpointDto[] }[];
}
