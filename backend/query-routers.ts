import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function queryRouters() {
  try {
    console.log('========================================');
    console.log('正在查询数据库中的路由器数据...');
    console.log('========================================\n');

    // 1. 查询所有路由器设备
    const routers = await prisma.device.findMany({
      where: {
        type: 'ROUTER',
      },
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
                        endpoints: {
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
                          },
                        },
                      },
                    },
                  },
                },
                opticalModule: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`找到 ${routers.length} 台路由器设备\n`);

    // 2. 输出每台路由器的详细信息
    for (const router of routers) {
      console.log('----------------------------------------');
      console.log(`路由器 ID: ${router.id}`);
      console.log(`名称: ${router.name}`);
      console.log(`型号: ${router.model || '未设置'}`);
      console.log(`序列号: ${router.serialNo || '未设置'}`);
      console.log(`U位位置: ${router.uPosition || '未设置'}`);
      console.log(`U高度: ${router.uHeight || '未设置'}`);

      // 位置信息
      const location = [
        router.cabinet.room.dataCenter.name,
        router.cabinet.room.name,
        router.cabinet.name,
      ].join(' > ');
      console.log(`位置: ${location}`);

      // 面板信息
      console.log(`\n面板数量: ${router.panels.length}`);
      for (const panel of router.panels) {
        console.log(`  - 面板: ${panel.name} (ID: ${panel.id}, ShortID: ${panel.shortId || '未分配'})`);
        console.log(`    类型: ${panel.type}`);
        console.log(`    端口数量: ${panel.ports.length}`);

        // 端口信息
        const availablePorts = panel.ports.filter(p => p.status === 'AVAILABLE');
        const occupiedPorts = panel.ports.filter(p => p.status === 'OCCUPIED');
        const connectedPorts = panel.ports.filter(p => p.cableEndpoints.length > 0);

        console.log(`    可用端口: ${availablePorts.length}`);
        console.log(`    占用端口: ${occupiedPorts.length}`);
        console.log(`    已连接端口: ${connectedPorts.length}`);

        // 显示连接详情
        if (connectedPorts.length > 0) {
          console.log(`    连接详情:`);
          for (const port of connectedPorts) {
            console.log(`      端口 ${port.number} (${port.label || '无标签'}):`);
            for (const endpoint of port.cableEndpoints) {
              const cable = endpoint.cable;
              console.log(`        - 线缆: ${cable.label || '未标记'} (类型: ${cable.type})`);

              // 找到对端
              const otherEndpoints = cable.endpoints.filter(e => e.id !== endpoint.id);
              for (const otherEnd of otherEndpoints) {
                if (otherEnd.port) {
                  const targetDevice = otherEnd.port.panel.device;
                  console.log(`          连接到: ${targetDevice.name} (${targetDevice.type}) - 面板 ${otherEnd.port.panel.name} - 端口 ${otherEnd.port.number}`);
                } else {
                  console.log(`          对端未连接`);
                }
              }
            }

            // 光模块信息
            if (port.opticalModule) {
              console.log(`        光模块: ${port.opticalModule.model} (${port.opticalModule.vendor})`);
              console.log(`          类型: ${port.opticalModule.moduleType}`);
              console.log(`          序列号: ${port.opticalModule.serialNo}`);
            }
          }
        }
      }

      console.log('');
    }

    console.log('========================================');
    console.log('统计信息');
    console.log('========================================');

    // 统计信息
    const totalPorts = routers.reduce((sum, r) =>
      sum + r.panels.reduce((psum, p) => psum + p.ports.length, 0), 0
    );

    const totalConnectedPorts = routers.reduce((sum, r) =>
      sum + r.panels.reduce((psum, p) =>
        psum + p.ports.filter(port => port.cableEndpoints.length > 0).length, 0
      ), 0
    );

    const totalCables = new Set(
      routers.flatMap(r =>
        r.panels.flatMap(p =>
          p.ports.flatMap(port =>
            port.cableEndpoints.map(e => e.cableId)
          )
        )
      )
    ).size;

    console.log(`路由器总数: ${routers.length}`);
    console.log(`总端口数: ${totalPorts}`);
    console.log(`已连接端口数: ${totalConnectedPorts}`);
    console.log(`涉及线缆数: ${totalCables}`);
    console.log(`端口利用率: ${totalPorts > 0 ? ((totalConnectedPorts / totalPorts) * 100).toFixed(2) : 0}%`);

    // 3. 查询路由器之间的直接连接
    console.log('\n========================================');
    console.log('路由器之间的连接关系');
    console.log('========================================\n');

    const routerConnections = [];
    for (const router of routers) {
      for (const panel of router.panels) {
        for (const port of panel.ports) {
          for (const endpoint of port.cableEndpoints) {
            const cable = endpoint.cable;
            for (const otherEnd of cable.endpoints) {
              if (otherEnd.id !== endpoint.id && otherEnd.port) {
                const targetDevice = otherEnd.port.panel.device;
                if (targetDevice.type === 'ROUTER') {
                  routerConnections.push({
                    from: router.name,
                    fromPort: `${panel.name}:${port.number}`,
                    to: targetDevice.name,
                    toPort: `${otherEnd.port.panel.name}:${otherEnd.port.number}`,
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

    if (routerConnections.length > 0) {
      console.log(`找到 ${routerConnections.length} 个路由器间连接:\n`);
      for (const conn of routerConnections) {
        console.log(`${conn.from} [${conn.fromPort}] <--(${conn.cable}:${conn.cableType})--> ${conn.to} [${conn.toPort}]`);
      }
    } else {
      console.log('没有找到路由器之间的直接连接');
    }

  } catch (error) {
    console.error('查询出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

queryRouters();
