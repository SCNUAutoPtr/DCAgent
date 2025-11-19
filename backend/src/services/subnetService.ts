import prisma from '../utils/prisma';
import { IpStatus } from '@prisma/client';

export interface CreateSubnetDto {
  name: string;
  network: string; // 网络地址，如 "192.168.1.0"
  cidr: number; // CIDR前缀，如 24
  gateway?: string;
  vlan?: string;
  dnsServers?: string[]; // DNS服务器列表
  description?: string;
  roomId?: string; // 关联机房
  autoGenerateIps?: boolean; // 是否自动生成IP地址池
  reservedIps?: string[]; // 保留的IP地址列表（网关、广播等）
}

export interface UpdateSubnetDto {
  name?: string;
  gateway?: string;
  vlan?: string;
  dnsServers?: string[];
  description?: string;
  roomId?: string;
}

export interface ListSubnetsQuery {
  roomId?: string;
  vlan?: string;
  search?: string;
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

class SubnetService {
  /**
   * 创建子网并可选地生成IP地址池
   */
  async createSubnet(data: CreateSubnetDto) {
    const {
      name,
      network,
      cidr,
      gateway,
      vlan,
      dnsServers,
      description,
      roomId,
      autoGenerateIps = true,
      reservedIps = [],
    } = data;

    // 验证网络地址格式
    if (!this.isValidIpAddress(network)) {
      throw new Error('无效的网络地址格式');
    }

    // 验证CIDR范围
    if (cidr < 0 || cidr > 32) {
      throw new Error('CIDR前缀必须在0-32之间');
    }

    // 如果提供了网关，验证格式
    if (gateway && !this.isValidIpAddress(gateway)) {
      throw new Error('无效的网关地址格式');
    }

    // 如果提供了机房ID，验证机房是否存在
    if (roomId) {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
      });
      if (!room) {
        throw new Error('机房不存在');
      }
    }

    // 计算子网信息
    const calculation = this.calculateSubnet(network, cidr);

    // 在事务中创建子网和IP地址池
    const result = await prisma.$transaction(async (tx) => {
      // 创建子网
      const subnet = await tx.ipSubnet.create({
        data: {
          name,
          network: calculation.networkAddress, // 使用计算后的规范网络地址
          cidr,
          gateway,
          vlan,
          dnsServers: dnsServers ? JSON.stringify(dnsServers) : null,
          description,
          roomId,
        },
      });

      // 如果需要自动生成IP地址池
      if (autoGenerateIps) {
        const ipAddresses: string[] = [];

        // 构建保留IP集合（包括网关、网络地址、广播地址）
        const reserved = new Set(reservedIps);
        reserved.add(calculation.networkAddress); // 网络地址
        reserved.add(calculation.broadcastAddress); // 广播地址
        if (gateway) {
          reserved.add(gateway);
        }

        // 生成所有可用IP
        for (const ip of calculation.ipRange) {
          const status = reserved.has(ip) ? IpStatus.RESERVED : IpStatus.FREE;
          ipAddresses.push(ip);

          // 批量创建IP地址记录
          await tx.ipAddress.create({
            data: {
              address: ip,
              subnetId: subnet.id,
              status,
              description: reserved.has(ip) ? '保留地址' : undefined,
            },
          });
        }

        console.log(`成功为子网 ${name} 生成 ${ipAddresses.length} 个IP地址`);
      }

      return subnet;
    });

    return result;
  }

  /**
   * 更新子网信息
   */
  async updateSubnet(subnetId: string, data: UpdateSubnetDto) {
    const { name, gateway, vlan, dnsServers, description, roomId } = data;

    // 如果提供了网关，验证格式
    if (gateway && !this.isValidIpAddress(gateway)) {
      throw new Error('无效的网关地址格式');
    }

    // 如果提供了机房ID，验证机房是否存在
    if (roomId) {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
      });
      if (!room) {
        throw new Error('机房不存在');
      }
    }

    const subnet = await prisma.ipSubnet.update({
      where: { id: subnetId },
      data: {
        name,
        gateway,
        vlan,
        dnsServers: dnsServers ? JSON.stringify(dnsServers) : undefined,
        description,
        roomId,
      },
    });

    return subnet;
  }

  /**
   * 获取子网详情
   */
  async getSubnetById(subnetId: string) {
    const subnet = await prisma.ipSubnet.findUnique({
      where: { id: subnetId },
      include: {
        room: {
          include: {
            dataCenter: true,
          },
        },
        ipAddresses: {
          include: {
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
        },
      },
    });

    if (!subnet) {
      return null;
    }

    // 计算统计信息
    const stats = this.calculateSubnetStats(subnet.ipAddresses);

    return {
      ...subnet,
      dnsServers: subnet.dnsServers ? JSON.parse(subnet.dnsServers as string) : [],
      stats,
    };
  }

  /**
   * 查询子网列表
   */
  async listSubnets(query: ListSubnetsQuery = {}) {
    const { roomId, vlan, search } = query;

    const where: any = {};

    if (roomId) {
      where.roomId = roomId;
    }

    if (vlan) {
      where.vlan = vlan;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { network: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const subnets = await prisma.ipSubnet.findMany({
      where,
      include: {
        room: {
          include: {
            dataCenter: true,
          },
        },
        ipAddresses: {
          select: {
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 为每个子网计算统计信息
    const enrichedSubnets = subnets.map((subnet) => {
      const stats = this.calculateSubnetStats(subnet.ipAddresses);
      return {
        ...subnet,
        dnsServers: subnet.dnsServers ? JSON.parse(subnet.dnsServers as string) : [],
        stats,
      };
    });

    return enrichedSubnets;
  }

  /**
   * 删除子网（会级联删除所有IP地址）
   */
  async deleteSubnet(subnetId: string) {
    // 检查是否有已分配的IP
    const allocatedCount = await prisma.ipAddress.count({
      where: {
        subnetId,
        status: IpStatus.ALLOCATED,
      },
    });

    if (allocatedCount > 0) {
      throw new Error(`子网中有 ${allocatedCount} 个IP已分配，无法删除`);
    }

    // 删除子网（会级联删除所有IP地址）
    return await prisma.ipSubnet.delete({
      where: { id: subnetId },
    });
  }

  /**
   * 计算子网信息
   */
  calculateSubnet(network: string, cidr: number): SubnetCalculationResult {
    // 将IP地址转换为32位整数
    const ipToInt = (ip: string): number => {
      const parts = ip.split('.').map(Number);
      return (
        (parts[0] << 24) |
        (parts[1] << 16) |
        (parts[2] << 8) |
        parts[3]
      ) >>> 0;
    };

    // 将32位整数转换为IP地址
    const intToIp = (int: number): string => {
      return [
        (int >>> 24) & 255,
        (int >>> 16) & 255,
        (int >>> 8) & 255,
        int & 255,
      ].join('.');
    };

    const networkInt = ipToInt(network);
    const maskInt = (0xffffffff << (32 - cidr)) >>> 0;
    const wildcardInt = ~maskInt >>> 0;

    // 计算网络地址
    const networkAddress = intToIp(networkInt & maskInt);

    // 计算广播地址
    const broadcastAddress = intToIp((networkInt & maskInt) | wildcardInt);

    // 计算第一个和最后一个可用IP
    const firstUsableIpInt = (networkInt & maskInt) + 1;
    const lastUsableIpInt = ((networkInt & maskInt) | wildcardInt) - 1;
    const firstUsableIp = intToIp(firstUsableIpInt);
    const lastUsableIp = intToIp(lastUsableIpInt);

    // 计算主机数
    const totalHosts = Math.pow(2, 32 - cidr);
    const usableHosts = totalHosts - 2; // 减去网络地址和广播地址

    // 生成IP范围（限制最大生成数量，避免大网段导致内存问题）
    const ipRange: string[] = [];
    const maxIps = Math.min(totalHosts, 65536); // 最多生成65536个IP（/16网段）

    if (totalHosts <= maxIps) {
      for (let i = 0; i < totalHosts; i++) {
        const ipInt = ((networkInt & maskInt) + i) >>> 0;
        ipRange.push(intToIp(ipInt));
      }
    } else {
      throw new Error(`子网过大（/${cidr}），包含 ${totalHosts} 个地址，超过限制 ${maxIps}`);
    }

    return {
      network,
      cidr,
      subnetMask: intToIp(maskInt),
      wildcardMask: intToIp(wildcardInt),
      networkAddress,
      broadcastAddress,
      firstUsableIp,
      lastUsableIp,
      totalHosts,
      usableHosts,
      ipRange,
    };
  }

  /**
   * 获取统计信息
   */
  async getStatistics() {
    const [totalSubnets, totalIps, freeIps, allocatedIps, reservedIps] = await Promise.all([
      prisma.ipSubnet.count(),
      prisma.ipAddress.count(),
      prisma.ipAddress.count({ where: { status: IpStatus.FREE } }),
      prisma.ipAddress.count({ where: { status: IpStatus.ALLOCATED } }),
      prisma.ipAddress.count({ where: { status: IpStatus.RESERVED } }),
    ]);

    // 按机房统计子网
    const subnetsByRoom = await prisma.ipSubnet.groupBy({
      by: ['roomId'],
      _count: true,
    });

    return {
      totalSubnets,
      totalIps,
      byStatus: {
        free: freeIps,
        allocated: allocatedIps,
        reserved: reservedIps,
      },
      utilizationRate: totalIps > 0 ? ((allocatedIps / (totalIps - reservedIps)) * 100).toFixed(2) : '0.00',
      subnetsByRoom: subnetsByRoom.map((item) => ({
        roomId: item.roomId,
        count: item._count,
      })),
    };
  }

  /**
   * 验证IP地址格式
   */
  private isValidIpAddress(ip: string): boolean {
    const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipRegex);

    if (!match) return false;

    return match.slice(1, 5).every((octet) => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  /**
   * 计算子网的IP统计信息
   */
  private calculateSubnetStats(ipAddresses: any[]) {
    const total = ipAddresses.length;
    const free = ipAddresses.filter((ip) => ip.status === IpStatus.FREE).length;
    const allocated = ipAddresses.filter((ip) => ip.status === IpStatus.ALLOCATED).length;
    const reserved = ipAddresses.filter((ip) => ip.status === IpStatus.RESERVED).length;
    const blocked = ipAddresses.filter((ip) => ip.status === IpStatus.BLOCKED).length;

    const usable = total - reserved;
    const utilizationRate = usable > 0 ? ((allocated / usable) * 100).toFixed(2) : '0.00';

    return {
      total,
      free,
      allocated,
      reserved,
      blocked,
      usable,
      utilizationRate,
    };
  }
}

export default new SubnetService();
