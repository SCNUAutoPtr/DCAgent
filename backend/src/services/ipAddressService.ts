import prisma from '../utils/prisma';
import { IpStatus } from '@prisma/client';

export interface AllocateIpDto {
  ipAddressId: string;
  portId?: string; // 绑定到端口（与deviceId二选一）
  deviceId?: string; // 绑定到设备（与portId二选一）
  hostname?: string;
  macAddress?: string;
  description?: string;
}

export interface ReleaseIpDto {
  clearHostname?: boolean; // 是否清除主机名
  clearMacAddress?: boolean; // 是否清除MAC地址
  clearDescription?: boolean; // 是否清除描述
}

export interface UpdateIpDto {
  hostname?: string;
  macAddress?: string;
  description?: string;
  status?: IpStatus;
}

export interface ListIpAddressesQuery {
  subnetId?: string;
  status?: IpStatus;
  portId?: string;
  deviceId?: string;
  search?: string; // 搜索IP地址、主机名、MAC地址
}

class IpAddressService {
  /**
   * 分配IP地址到端口或设备
   */
  async allocateIp(data: AllocateIpDto) {
    const { ipAddressId, portId, deviceId, hostname, macAddress, description } = data;

    // 验证必须提供portId或deviceId之一
    if (!portId && !deviceId) {
      throw new Error('必须指定端口或设备');
    }

    if (portId && deviceId) {
      throw new Error('不能同时绑定端口和设备');
    }

    // 查询IP地址
    const ipAddress = await prisma.ipAddress.findUnique({
      where: { id: ipAddressId },
      include: {
        subnet: true,
      },
    });

    if (!ipAddress) {
      throw new Error('IP地址不存在');
    }

    // 检查IP状态
    if (ipAddress.status === IpStatus.ALLOCATED) {
      throw new Error('IP地址已被分配');
    }

    if (ipAddress.status === IpStatus.RESERVED) {
      throw new Error('IP地址为保留地址，无法分配');
    }

    if (ipAddress.status === IpStatus.BLOCKED) {
      throw new Error('IP地址已被禁用');
    }

    // 如果绑定到端口，验证端口
    if (portId) {
      const port = await prisma.port.findUnique({
        where: { id: portId },
        include: {
          ipAddress: true,
        },
      });

      if (!port) {
        throw new Error('端口不存在');
      }

      if (port.ipAddress) {
        throw new Error(`端口已绑定IP地址 ${port.ipAddress.address}`);
      }
    }

    // 如果绑定到设备，验证设备
    if (deviceId) {
      const device = await prisma.device.findUnique({
        where: { id: deviceId },
      });

      if (!device) {
        throw new Error('设备不存在');
      }
    }

    // 分配IP地址
    const result = await prisma.ipAddress.update({
      where: { id: ipAddressId },
      data: {
        status: IpStatus.ALLOCATED,
        portId,
        deviceId,
        hostname,
        macAddress,
        description,
      },
      include: {
        subnet: true,
        port: {
          include: {
            panel: {
              include: {
                device: true,
              },
            },
          },
        },
        device: true,
      },
    });

    return result;
  }

  /**
   * 释放IP地址
   */
  async releaseIp(ipAddressId: string, options: ReleaseIpDto = {}) {
    const {
      clearHostname = false,
      clearMacAddress = false,
      clearDescription = false,
    } = options;

    // 查询IP地址
    const ipAddress = await prisma.ipAddress.findUnique({
      where: { id: ipAddressId },
    });

    if (!ipAddress) {
      throw new Error('IP地址不存在');
    }

    if (ipAddress.status !== IpStatus.ALLOCATED) {
      throw new Error('IP地址未分配，无需释放');
    }

    // 释放IP地址
    const result = await prisma.ipAddress.update({
      where: { id: ipAddressId },
      data: {
        status: IpStatus.FREE,
        portId: null,
        deviceId: null,
        hostname: clearHostname ? null : ipAddress.hostname,
        macAddress: clearMacAddress ? null : ipAddress.macAddress,
        description: clearDescription ? null : ipAddress.description,
      },
      include: {
        subnet: true,
      },
    });

    return result;
  }

  /**
   * 批量分配IP（从子网自动选择）
   */
  async batchAllocateFromSubnet(
    subnetId: string,
    targets: Array<{ portId?: string; deviceId?: string; hostname?: string; macAddress?: string }>
  ) {
    // 获取子网的空闲IP列表
    const freeIps = await prisma.ipAddress.findMany({
      where: {
        subnetId,
        status: IpStatus.FREE,
      },
      orderBy: {
        address: 'asc',
      },
      take: targets.length,
    });

    if (freeIps.length < targets.length) {
      throw new Error(`子网中空闲IP不足，需要 ${targets.length} 个，仅有 ${freeIps.length} 个`);
    }

    // 批量分配
    const results = await Promise.all(
      targets.map((target, index) => {
        return this.allocateIp({
          ipAddressId: freeIps[index].id,
          ...target,
        });
      })
    );

    return results;
  }

  /**
   * 获取下一个可用IP（用于自动分配）
   */
  async getNextAvailableIp(subnetId: string) {
    const freeIp = await prisma.ipAddress.findFirst({
      where: {
        subnetId,
        status: IpStatus.FREE,
      },
      orderBy: {
        address: 'asc',
      },
    });

    return freeIp;
  }

  /**
   * 更新IP地址信息
   */
  async updateIpAddress(ipAddressId: string, data: UpdateIpDto) {
    const { hostname, macAddress, description, status } = data;

    // 如果要修改状态，需要验证
    if (status !== undefined) {
      const ipAddress = await prisma.ipAddress.findUnique({
        where: { id: ipAddressId },
      });

      if (!ipAddress) {
        throw new Error('IP地址不存在');
      }

      // 如果要标记为已分配，必须已绑定端口或设备
      if (status === IpStatus.ALLOCATED && !ipAddress.portId && !ipAddress.deviceId) {
        throw new Error('IP地址未绑定端口或设备，无法标记为已分配');
      }

      // 如果要标记为空闲，必须先解除绑定
      if (status === IpStatus.FREE && (ipAddress.portId || ipAddress.deviceId)) {
        throw new Error('IP地址已绑定端口或设备，无法标记为空闲');
      }
    }

    const result = await prisma.ipAddress.update({
      where: { id: ipAddressId },
      data: {
        hostname,
        macAddress,
        description,
        status,
      },
      include: {
        subnet: true,
        port: {
          include: {
            panel: {
              include: {
                device: true,
              },
            },
          },
        },
        device: true,
      },
    });

    return result;
  }

  /**
   * 根据ID获取IP地址详情
   */
  async getIpAddressById(ipAddressId: string) {
    const ipAddress = await prisma.ipAddress.findUnique({
      where: { id: ipAddressId },
      include: {
        subnet: {
          include: {
            room: {
              include: {
                dataCenter: true,
              },
            },
          },
        },
        port: {
          include: {
            panel: {
              include: {
                device: {
                  include: {
                    cabinet: {
                      include: {
                        room: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        device: {
          include: {
            cabinet: {
              include: {
                room: true,
              },
            },
          },
        },
      },
    });

    return ipAddress;
  }

  /**
   * 根据IP地址字符串查询
   */
  async getIpAddressByAddress(address: string) {
    const ipAddress = await prisma.ipAddress.findUnique({
      where: { address },
      include: {
        subnet: true,
        port: {
          include: {
            panel: {
              include: {
                device: true,
              },
            },
          },
        },
        device: true,
      },
    });

    return ipAddress;
  }

  /**
   * 查询IP地址列表
   */
  async listIpAddresses(query: ListIpAddressesQuery = {}) {
    const { subnetId, status, portId, deviceId, search } = query;

    const where: any = {};

    if (subnetId) {
      where.subnetId = subnetId;
    }

    if (status) {
      where.status = status;
    }

    if (portId) {
      where.portId = portId;
    }

    if (deviceId) {
      where.deviceId = deviceId;
    }

    if (search) {
      where.OR = [
        { address: { contains: search, mode: 'insensitive' } },
        { hostname: { contains: search, mode: 'insensitive' } },
        { macAddress: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const ipAddresses = await prisma.ipAddress.findMany({
      where,
      include: {
        subnet: true,
        port: {
          include: {
            panel: {
              include: {
                device: true,
              },
            },
          },
        },
        device: true,
      },
      orderBy: {
        address: 'asc',
      },
    });

    return ipAddresses;
  }

  /**
   * 检查IP冲突（同一子网内的MAC地址冲突）
   */
  async checkConflicts(subnetId?: string) {
    const where: any = {
      macAddress: { not: null },
      status: IpStatus.ALLOCATED,
    };

    if (subnetId) {
      where.subnetId = subnetId;
    }

    // 查询所有已分配且有MAC地址的IP
    const ipAddresses = await prisma.ipAddress.findMany({
      where,
      include: {
        subnet: true,
      },
      orderBy: {
        macAddress: 'asc',
      },
    });

    // 检测MAC地址冲突
    const conflicts: Array<{
      macAddress: string;
      ipAddresses: any[];
    }> = [];

    const macMap = new Map<string, any[]>();
    ipAddresses.forEach((ip) => {
      const mac = ip.macAddress!.toLowerCase();
      if (!macMap.has(mac)) {
        macMap.set(mac, []);
      }
      macMap.get(mac)!.push(ip);
    });

    macMap.forEach((ips, mac) => {
      if (ips.length > 1) {
        conflicts.push({
          macAddress: mac,
          ipAddresses: ips,
        });
      }
    });

    return conflicts;
  }

  /**
   * 删除IP地址（仅限空闲状态）
   */
  async deleteIpAddress(ipAddressId: string) {
    const ipAddress = await prisma.ipAddress.findUnique({
      where: { id: ipAddressId },
    });

    if (!ipAddress) {
      throw new Error('IP地址不存在');
    }

    if (ipAddress.status === IpStatus.ALLOCATED) {
      throw new Error('IP地址已分配，无法删除');
    }

    return await prisma.ipAddress.delete({
      where: { id: ipAddressId },
    });
  }
}

export default new IpAddressService();
