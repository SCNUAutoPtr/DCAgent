// IPv4 helpers. Pure and dependency-free (the frontend imports values from here).

export function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function intToIpv4(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

export interface ParsedCidr {
  network: string;
  prefix: number;
}

/** "192.168.99.0/24" -> {network, prefix}; null when not a valid IPv4 CIDR. */
export function parseCidr(text: string): ParsedCidr | null {
  const [ip, len] = text.trim().split('/');
  const n = ipv4ToInt(ip ?? '');
  const prefix = Number(len);
  if (n === null || len === undefined || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  return { network: intToIpv4(n), prefix };
}

const maskOf = (prefix: number) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);

export function isNetworkAddress(c: ParsedCidr): boolean {
  const n = ipv4ToInt(c.network)!;
  return ((n & maskOf(c.prefix)) >>> 0) === n;
}

export function ipInCidr(ip: string, c: ParsedCidr): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  const mask = maskOf(c.prefix);
  return ((n & mask) >>> 0) === ((ipv4ToInt(c.network)! & mask) >>> 0);
}

/** Usable hosts: /31 has 2 (RFC 3021), /32 has 1, otherwise network and broadcast are excluded. */
export function subnetCapacity(prefix: number): number {
  if (prefix >= 32) return 1;
  if (prefix === 31) return 2;
  return 2 ** (32 - prefix) - 2;
}

export interface SubnetCalculation {
  network: string;
  cidr: number;
  subnetMask: string;
  wildcardMask: string;
  networkAddress: string;
  broadcastAddress: string;
  firstUsableIp: string;
  lastUsableIp: string;
  totalHosts: number;
  usableHosts: number;
}

export function calculateSubnet(c: ParsedCidr): SubnetCalculation {
  const mask = maskOf(c.prefix);
  const base = (ipv4ToInt(c.network)! & mask) >>> 0;
  const broadcast = (base | (~mask >>> 0)) >>> 0;
  const small = c.prefix >= 31;
  return {
    network: `${intToIpv4(base)}/${c.prefix}`,
    cidr: c.prefix,
    subnetMask: intToIpv4(mask),
    wildcardMask: intToIpv4(~mask >>> 0),
    networkAddress: intToIpv4(base),
    broadcastAddress: intToIpv4(broadcast),
    firstUsableIp: intToIpv4(small ? base : base + 1),
    lastUsableIp: intToIpv4(small ? broadcast : broadcast - 1),
    totalHosts: 2 ** (32 - c.prefix),
    usableHosts: subnetCapacity(c.prefix),
  };
}
