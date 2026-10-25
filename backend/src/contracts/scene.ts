import type { CableMedium, DeviceType, PanelFace, WorkstationAdminState } from './enums';
import type { LabelRef } from './common';

/**
 * rooms/scene coordinate system: metres, origin at the room's top-left corner,
 * x to the right, y into the room. fpRotation 0 = cabinet front faces -y.
 */
export const DEFAULT_CABINET_WIDTH_M = 0.6;
export const DEFAULT_CABINET_DEPTH_M = 1.2;
export const DEFAULT_WORKSTATION_WIDTH_M = 1.2;
export const DEFAULT_WORKSTATION_DEPTH_M = 0.6;
export const U_HEIGHT_MM = 44.45;

export interface ScenePanel {
  id: string;
  name: string;
  face: PanelFace;
  portCount: number;
  connectedCount: number;
}

export interface SceneDevice {
  id: string;
  name: string;
  type: DeviceType;
  uPosition: number | null;
  /** null: height not known (drawn as 1U) */
  uHeight: number | null;
  deviceModel: { id: string; name: string; depthMm: number | null } | null;
  panels: ScenePanel[];
}

export interface SceneCabinet {
  id: string;
  name: string;
  label: LabelRef | null;
  fpX: number | null;
  fpY: number | null;
  fpW: number | null;
  fpD: number | null;
  fpRotation: number;
  heightU: number;
  devices: SceneDevice[];
}

export interface SceneWorkstation {
  id: string;
  name: string;
  fpX: number | null;
  fpY: number | null;
  fpW: number | null;
  fpD: number | null;
  online: boolean;
  adminState: WorkstationAdminState;
}

/** One cable with both ends plugged into ports of devices in this room (a and b may be the same device). */
export interface SceneLink {
  cableId: string;
  medium: CableMedium;
  aDeviceId: string;
  aFace: PanelFace;
  bDeviceId: string;
  bFace: PanelFace;
}

export interface RoomScene {
  room: { id: string; name: string; widthM: number | null; depthM: number | null };
  cabinets: SceneCabinet[];
  looseDevices: SceneDevice[];
  workstations: SceneWorkstation[];
  links: SceneLink[];
  /** cables with one end in this room and the other end plugged in elsewhere */
  externalLinkCount: number;
}
