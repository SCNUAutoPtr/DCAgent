import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function queryAllDevices() {
  try {
    console.log('========================================');
    console.log('查询数据库中的所有设备');
    console.log('========================================\n');

    // 1. 统计各类型设备数量
    const devicesByType = await prisma.device.groupBy({
      by: ['type'],
      _count: true,
    });

    console.log('设备类型统计:');
    for (const item of devicesByType) {
      console.log(`  ${item.type}: ${item._count} 台`);
    }

    // 2. 获取所有设备的详细信息
    const allDevices = await prisma.device.findMany({
      include: {
        cabinet: {
          include: {
            room: {
              include: {
                dataCenter: true,
              },
            },
          },
        },
        panels: {
          include: {
            ports: {
              include: {
                cableEndpoints: {
                  include: {
                    cable: {
                      include: {
                        endpoints: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' },
      ],
    });

    console.log(`\n总共 ${allDevices.length} 台设备\n`);

    // 3. 按类型分组显示设备
    const deviceGroups = new Map<string, typeof allDevices>();
    for (const device of allDevices) {
      if (!deviceGroups.has(device.type)) {
        deviceGroups.set(device.type, []);
      }
      deviceGroups.get(device.type)!.push(device);
    }

    for (const [type, devices] of deviceGroups) {
      console.log('========================================');
      console.log(`${type} (${devices.length} 台)`);
      console.log('========================================\n');

      for (const device of devices) {
        console.log(`ID: ${device.id}`);
        console.log(`名称: ${device.name}`);
        console.log(`型号: ${device.model || '未设置'}`);
        console.log(`序列号: ${device.serialNo || '未设置'}`);

        // 位置
        const location = [
          device.cabinet.room.dataCenter.name,
          device.cabinet.room.name,
          device.cabinet.name,
        ].join(' > ');
        console.log(`位置: ${location}`);

        // 面板和端口统计
        const totalPorts = device.panels.reduce((sum, p) => sum + p.ports.length, 0);
        const connectedPorts = device.panels.reduce(
          (sum, p) => sum + p.ports.filter(port => port.cableEndpoints.length > 0).length,
          0
        );

        console.log(`面板数: ${device.panels.length}`);
        console.log(`端口数: ${totalPorts}`);
        console.log(`已连接端口: ${connectedPorts}`);

        // 面板详情
        if (device.panels.length > 0) {
          console.log('面板详情:');
          for (const panel of device.panels) {
            const panelConnected = panel.ports.filter(p => p.cableEndpoints.length > 0).length;
            console.log(`  - ${panel.name} (${panel.type}): ${panel.ports.length} 端口, ${panelConnected} 已连接, ShortID: ${panel.shortId || '未分配'}`);
          }
        }

        console.log('');
      }
    }

    // 4. 查询设备之间的连接关系
    console.log('========================================');
    console.log('设备连接拓扑');
    console.log('========================================\n');

    const connections = [];
    for (const device of allDevices) {
      for (const panel of device.panels) {
        for (const port of panel.ports) {
          for (const endpoint of port.cableEndpoints) {
            const cable = endpoint.cable;
            for (const otherEnd of cable.endpoints) {
              if (otherEnd.id !== endpoint.id && otherEnd.portId) {
                // 查询对端端口信息
                const targetPort = await prisma.port.findUnique({
                  where: { id: otherEnd.portId },
                  include: {
                    panel: {
                      include: {
                        device: true,
                      },
                    },
                  },
                });

                if (targetPort) {
                  connections.push({
                    fromDevice: device.name,
                    fromType: device.type,
                    fromPanel: panel.name,
                    fromPort: port.number,
                    toDevice: targetPort.panel.device.name,
                    toType: targetPort.panel.device.type,
                    toPanel: targetPort.panel.name,
                    toPort: targetPort.number,
                    cable: cable.label || '未标记',
                    cableType: cable.type,
                  });
                }
              }
            }
          }
        }
      }
    }

    if (connections.length > 0) {
      console.log(`找到 ${connections.length} 个连接:\n`);
      for (const conn of connections) {
        console.log(
          `${conn.fromDevice}(${conn.fromType}) [${conn.fromPanel}:${conn.fromPort}] <--(${conn.cable}:${conn.cableType})--> ${conn.toDevice}(${conn.toType}) [${conn.toPanel}:${conn.toPort}]`
        );
      }
    } else {
      console.log('没有找到设备之间的连接');
    }

  } catch (error) {
    console.error('查询出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

queryAllDevices();
