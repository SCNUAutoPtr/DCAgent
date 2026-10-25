import { z } from 'zod';
import { IP_STATUSES } from './enums';
import type { IpStatus } from './enums';
import { idSchema, optText, paging, searchText } from './common';

import { intToIpv4, ipv4ToInt, isNetworkAddress, parseCidr } from './ipv4';
export { calculateSubnet, intToIpv4, ipInCidr, ipv4ToInt, isNetworkAddress, parseCidr, subnetCapacity } from './ipv4';
export type { ParsedCidr, SubnetCalculation } from './ipv4';

// ---------- schemas ----------

export const ipv4Schema = z
  .string()
  .trim()
  .refine((v) => ipv4ToInt(v) !== null, { message: 'invalid IPv4 address' })
  .transform((v) => intToIpv4(ipv4ToInt(v)!));

export const cidrSchema = z
  .string()
  .trim()
  .refine((v) => parseCidr(v) !== null, { message: 'invalid CIDR, expected a.b.c.d/nn' })
  .refine((v) => isNetworkAddress(parseCidr(v)!), { message: 'host bits must be zero' })
  .transform((v) => {
    const c = parseCidr(v)!;
    return `${c.network}/${c.prefix}`;
  });

const macSchema = z
  .string()
  .trim()
  .regex(/^[0-9A-Fa-f]{2}([:-]?[0-9A-Fa-f]{2}){5}$/, 'invalid MAC address')
  .transform((v) => v.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().match(/../g)!.join(':'));

export const subnetListSchema = z.object({ roomId: idSchema.optional(), search: searchText });
export const subnetCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  network: cidrSchema,
  gateway: ipv4Schema.nullish(),
  vlan: z.number().int().min(1).max(4094).nullish(),
  dnsServers: z.array(ipv4Schema).max(8).default([]),
  description: optText(),
  roomId: idSchema.nullish(),
});
export const subnetUpdateSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(200).optional(),
  network: cidrSchema.optional(),
  gateway: ipv4Schema.nullish(),
  vlan: z.number().int().min(1).max(4094).nullish(),
  dnsServers: z.array(ipv4Schema).max(8).optional(),
  description: optText().optional(),
  roomId: idSchema.nullish(),
});
export const subnetDeleteSchema = z.object({ id: idSchema, force: z.boolean().default(false) });
export const subnetCalculateSchema = z.object({ network: cidrSchema });

const owner = {
  portId: idSchema.nullish(),
  deviceId: idSchema.nullish(),
  workstationId: idSchema.nullish(),
};
const oneOwner = (v: { portId?: string | null; deviceId?: string | null; workstationId?: string | null }) =>
  [v.portId, v.deviceId, v.workstationId].filter(Boolean).length <= 1;

export const ipListSchema = z.object({
  subnetId: idSchema,
  status: z.enum(IP_STATUSES).optional(),
  search: searchText,
  ...paging,
});
export const ipGetByAddressSchema = z.object({ address: ipv4Schema, subnetId: idSchema.optional() });
export const ipAllocateSchema = z
  .object({
    subnetId: idSchema,
    /** omitted: next free address */
    address: ipv4Schema.optional(),
    status: z.enum(IP_STATUSES).default('ALLOCATED'),
    ...owner,
    hostname: optText(200),
    macAddress: macSchema.nullish(),
    description: optText(),
  })
  .refine(oneOwner, { message: 'an address belongs to at most one of port, device, workstation' });
export const ipBatchAllocateSchema = z.object({
  subnetId: idSchema,
  count: z.number().int().min(1).max(1024),
  status: z.enum(IP_STATUSES).default('RESERVED'),
  description: optText(),
});
export const ipNextAvailableSchema = z.object({ subnetId: idSchema, count: z.number().int().min(1).max(1024).default(1) });
export const ipUpdateSchema = z
  .object({
    id: idSchema,
    status: z.enum(IP_STATUSES).optional(),
    ...owner,
    hostname: optText(200).optional(),
    macAddress: macSchema.nullish(),
    description: optText().optional(),
  })
  .refine(oneOwner, { message: 'an address belongs to at most one of port, device, workstation' });
export const ipCheckConflictsSchema = z.object({ subnetId: idSchema.optional() });

export interface SubnetUsage {
  capacity: number;
  allocated: number;
  reserved: number;
  blocked: number;
  free: number;
  /** allocated / (capacity - reserved - blocked), percent with 2 decimals */
  utilization: number;
}

export interface SubnetDto {
  id: string;
  name: string;
  network: string;
  cidr: number;
  gateway: string | null;
  vlan: number | null;
  dnsServers: string[];
  description: string | null;
  roomId: string | null;
  roomName: string | null;
  usage: SubnetUsage;
  createdAt: string;
  updatedAt: string;
}

export interface IpAddressDto {
  id: string;
  subnetId: string;
  address: string;
  status: IpStatus;
  portId: string | null;
  deviceId: string | null;
  workstationId: string | null;
  /** derived owner: the port's device, the device itself, or the workstation */
  owner: { kind: 'PORT' | 'DEVICE' | 'WORKSTATION'; id: string; name: string; deviceId: string | null } | null;
  hostname: string | null;
  macAddress: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IpConflict {
  kind: 'ADDRESS_IN_MULTIPLE_SUBNETS' | 'DUPLICATE_MAC';
  value: string;
  ipAddressIds: string[];
}

export interface IpStatistics {
  totalSubnets: number;
  capacity: number;
  allocated: number;
  reserved: number;
  blocked: number;
  free: number;
  utilization: number;
}
