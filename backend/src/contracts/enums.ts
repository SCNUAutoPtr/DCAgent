// Dependency-free enum values shared by backend and frontend.
// Must stay in sync with prisma/schema.prisma (checked by src/contracts/enums.test.ts).

export const DEVICE_TYPES = ['SERVER', 'SWITCH', 'ROUTER', 'FIREWALL', 'STORAGE', 'PDU', 'OTHER'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const PANEL_TYPES = ['NETWORK', 'POWER', 'CONSOLE', 'USB', 'OTHER'] as const;
export type PanelType = (typeof PANEL_TYPES)[number];

export const PANEL_FACES = ['FRONT', 'REAR'] as const;
export type PanelFace = (typeof PANEL_FACES)[number];

export const PORT_TYPES = [
  'RJ45', 'SFP', 'SFP_PLUS', 'SFP28', 'QSFP', 'QSFP28', 'QSFP_DD', 'CONSOLE', 'USB', 'POWER', 'OTHER',
] as const;
export type PortType = (typeof PORT_TYPES)[number];

export const PORT_ADMIN_STATES = ['NORMAL', 'RESERVED', 'FAULTY'] as const;
export type PortAdminState = (typeof PORT_ADMIN_STATES)[number];

export const CABLE_MEDIA = ['CAT5E', 'CAT6', 'CAT6A', 'CAT7', 'FIBER_SM', 'FIBER_MM', 'DAC', 'AOC', 'POWER', 'OTHER'] as const;
export type CableMedium = (typeof CABLE_MEDIA)[number];

export const CONNECTOR_TYPES = ['RJ45', 'LC', 'SC', 'MPO', 'SFP', 'SFP_PLUS', 'QSFP', 'QSFP28', 'OTHER'] as const;
export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

export const CABLE_ENDS = ['A', 'B'] as const;
export type CableEnd = (typeof CABLE_ENDS)[number];

/** Derived, never stored: STOCK = no end plugged into a port, IN_USE = at least one end plugged. */
export const CABLE_STATES = ['STOCK', 'IN_USE'] as const;
export type CableState = (typeof CABLE_STATES)[number];

export const LABEL_STATES = ['GENERATED', 'PRINTED', 'VOID'] as const;
export type LabelState = (typeof LABEL_STATES)[number];

export const LABEL_KINDS = ['ROOM', 'CABINET', 'PANEL', 'CABLE_ENDPOINT'] as const;
export type LabelKind = (typeof LABEL_KINDS)[number];

export const PRINT_TASK_STATUSES = ['PENDING', 'COMPLETED', 'FAILED'] as const;
export type PrintTaskStatus = (typeof PRINT_TASK_STATUSES)[number];

export const MODULE_STATUSES = ['IN_STOCK', 'INSTALLED', 'RESERVED', 'FAULTY', 'SCRAPPED'] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

export const TRANSCEIVER_FORMS = ['SFP', 'SFP_PLUS', 'SFP28', 'QSFP', 'QSFP28', 'QSFP_DD', 'OTHER'] as const;
export type TransceiverForm = (typeof TRANSCEIVER_FORMS)[number];

export const MOVEMENT_TYPES = ['PURCHASE', 'INSTALL', 'UNINSTALL', 'TRANSFER', 'REPAIR', 'RETURN', 'SCRAP'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const IP_STATUSES = ['ALLOCATED', 'RESERVED', 'BLOCKED'] as const;
export type IpStatus = (typeof IP_STATUSES)[number];

export const WORKSTATION_ADMIN_STATES = ['ACTIVE', 'MAINTENANCE', 'FAULTY', 'RETIRED'] as const;
export type WorkstationAdminState = (typeof WORKSTATION_ADMIN_STATES)[number];

export const UNMATCHED_SOURCES = ['WORKSTATION_ATTACH', 'PORT_OBSERVATION'] as const;
export type UnmatchedSource = (typeof UNMATCHED_SOURCES)[number];

export const PATH_KINDS = ['DATACENTER', 'ROOM', 'CABINET', 'DEVICE', 'PANEL', 'PORT', 'CABLE', 'CABLE_ENDPOINT'] as const;
export type PathKind = (typeof PATH_KINDS)[number];

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'UNIQUE_VIOLATION',
  'LABEL_NOT_AVAILABLE',
  'LABEL_REQUIRED',
  'PORT_OCCUPIED',
  'PORT_HAS_DEPENDENTS',
  'NOT_EMPTY',
  'U_SPACE_CONFLICT',
  'U_OUT_OF_RANGE',
  'IP_OUT_OF_SUBNET',
  'IP_CONFLICT',
  'TEMPLATE_REVISION_MISMATCH',
  'TEMPLATE_CONFLICT',
  'INVALID_STATE',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
