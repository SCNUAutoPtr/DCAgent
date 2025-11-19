import api from './api';

export interface IpSubnet {
  id: string;
  name: string;
  network: string;
  cidr: number;
  gateway?: string;
  vlan?: string;
  dnsServers?: string[];
  description?: string;
  roomId?: string;
  room?: any;
  ipAddresses?: IpAddress[];
  stats?: {
    total: number;
    free: number;
    allocated: number;
    reserved: number;
    blocked: number;
    usable: number;
    utilizationRate: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface IpAddress {
  id: string;
  address: string;
  subnetId: string;
  subnet?: IpSubnet;
  status: 'FREE' | 'ALLOCATED' | 'RESERVED' | 'BLOCKED';
  portId?: string;
  port?: any;
  deviceId?: string;
  device?: any;
  hostname?: string;
  macAddress?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubnetDto {
  name: string;
  network: string;
  cidr: number;
  gateway?: string;
  vlan?: string;
  dnsServers?: string[];
  description?: string;
  roomId?: string;
  autoGenerateIps?: boolean;
  reservedIps?: string[];
}

export interface UpdateSubnetDto {
  name?: string;
  gateway?: string;
  vlan?: string;
  dnsServers?: string[];
  description?: string;
  roomId?: string;
}

export interface AllocateIpDto {
  ipAddressId: string;
  portId?: string;
  deviceId?: string;
  hostname?: string;
  macAddress?: string;
  description?: string;
}

export interface SubnetCalculationResult {
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
  ipRange: string[];
}

export const ipService = {
  // ===== 子网管理 =====

  // 获取所有子网
  async getSubnets(params?: { roomId?: string; vlan?: string; search?: string }): Promise<IpSubnet[]> {
    const response = await api.get('/subnets', { params });
    return response.data;
  },

  // 获取子网详情
  async getSubnetById(id: string): Promise<IpSubnet> {
    const response = await api.post('/subnets/get', { id });
    return response.data;
  },

  // 创建子网
  async createSubnet(data: CreateSubnetDto): Promise<IpSubnet> {
    const response = await api.post('/subnets/create', data);
    return response.data;
  },

  // 更新子网
  async updateSubnet(id: string, data: UpdateSubnetDto): Promise<IpSubnet> {
    const response = await api.post('/subnets/update', { id, ...data });
    return response.data;
  },

  // 删除子网
  async deleteSubnet(id: string): Promise<void> {
    await api.post('/subnets/delete', { id });
  },

  // 计算子网
  async calculateSubnet(network: string, cidr: number): Promise<SubnetCalculationResult> {
    const response = await api.post('/subnets/calculate', { network, cidr });
    return response.data;
  },

  // 获取子网统计
  async getSubnetStatistics(): Promise<any> {
    const response = await api.get('/subnets/statistics');
    return response.data;
  },

  // ===== IP地址管理 =====

  // 获取IP地址列表
  async getIpAddresses(params?: {
    subnetId?: string;
    status?: string;
    portId?: string;
    deviceId?: string;
    search?: string;
  }): Promise<IpAddress[]> {
    const response = await api.get('/ip-addresses', { params });
    return response.data;
  },

  // 获取IP地址详情
  async getIpAddressById(id: string): Promise<IpAddress> {
    const response = await api.post('/ip-addresses/get', { id });
    return response.data;
  },

  // 根据IP地址字符串查询
  async getIpAddressByAddress(address: string): Promise<IpAddress> {
    const response = await api.post('/ip-addresses/get-by-address', { address });
    return response.data;
  },

  // 分配IP地址
  async allocateIp(data: AllocateIpDto): Promise<IpAddress> {
    const response = await api.post('/ip-addresses/allocate', data);
    return response.data;
  },

  // 释放IP地址
  async releaseIp(
    ipAddressId: string,
    options?: {
      clearHostname?: boolean;
      clearMacAddress?: boolean;
      clearDescription?: boolean;
    }
  ): Promise<IpAddress> {
    const response = await api.post('/ip-addresses/release', { ipAddressId, ...options });
    return response.data;
  },

  // 批量分配IP
  async batchAllocate(
    subnetId: string,
    targets: Array<{
      portId?: string;
      deviceId?: string;
      hostname?: string;
      macAddress?: string;
    }>
  ): Promise<IpAddress[]> {
    const response = await api.post('/ip-addresses/batch-allocate', { subnetId, targets });
    return response.data;
  },

  // 获取下一个可用IP
  async getNextAvailableIp(subnetId: string): Promise<IpAddress> {
    const response = await api.post('/ip-addresses/next-available', { subnetId });
    return response.data;
  },

  // 更新IP地址
  async updateIpAddress(
    id: string,
    data: {
      hostname?: string;
      macAddress?: string;
      description?: string;
      status?: string;
    }
  ): Promise<IpAddress> {
    const response = await api.post('/ip-addresses/update', { id, ...data });
    return response.data;
  },

  // 删除IP地址
  async deleteIpAddress(id: string): Promise<void> {
    await api.post('/ip-addresses/delete', { id });
  },

  // 检查IP冲突
  async checkConflicts(subnetId?: string): Promise<Array<{ macAddress: string; ipAddresses: IpAddress[] }>> {
    const response = await api.post('/ip-addresses/check-conflicts', { subnetId });
    return response.data;
  },
};

export default ipService;
