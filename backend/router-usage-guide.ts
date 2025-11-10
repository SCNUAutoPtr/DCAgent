/**
 * 路由器数据探索和使用指南
 *
 * 本脚本展示如何在数据库中操作路由器设备
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function demonstrateRouterOperations() {
  try {
    console.log('========================================');
    console.log('路由器操作演示指南');
    console.log('========================================\n');

    // 1. 获取现有的机柜（路由器需要放在机柜中）
    const cabinets = await prisma.cabinet.findMany({
      include: {
        room: {
          include: {
            dataCenter: true,
          },
        },
      },
    });

    if (cabinets.length === 0) {
      console.log('错误: 数据库中没有机柜，无法创建路由器。请先创建数据中心、机房和机柜。');
      return;
    }

    console.log('1. 现有机柜列表:');
    for (const cabinet of cabinets) {
      console.log(`   - ${cabinet.name} (ID: ${cabinet.id})`);
      console.log(`     位置: ${cabinet.room.dataCenter.name} > ${cabinet.room.name}`);
    }

    const targetCabinet = cabinets[0];
    console.log(`\n将使用机柜: ${targetCabinet.name}\n`);

    // 2. 创建路由器的示例代码
    console.log('========================================');
    console.log('2. 如何创建路由器设备');
    console.log('========================================\n');

    console.log('方法1: 使用 Prisma 直接创建');
    console.log(`
const router = await prisma.device.create({
  data: {
    name: '核心路由器-1',
    type: 'ROUTER',  // 设备类型为 ROUTER
    model: 'Cisco ISR 4451',
    serialNo: 'FCW2150ABCD',
    cabinetId: '${targetCabinet.id}',
    uPosition: 1,  // U位位置
    uHeight: 2,    // 占用2U
  },
  include: {
    cabinet: true,
    panels: true,
  },
});
console.log('路由器创建成功:', router);
`);

    console.log('\n方法2: 使用后端 API (推荐)');
    console.log(`
POST http://localhost:3000/api/v1/devices/create
Content-Type: application/json

{
  "name": "核心路由器-1",
  "type": "ROUTER",
  "model": "Cisco ISR 4451",
  "serialNo": "FCW2150ABCD",
  "cabinetId": "${targetCabinet.id}",
  "uPosition": 1,
  "uHeight": 2
}
`);

    // 3. 查询路由器的方法
    console.log('========================================');
    console.log('3. 如何查询路由器设备');
    console.log('========================================\n');

    console.log('方法1: 使用 Prisma 查询所有路由器');
    console.log(`
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
        ports: true,
      },
    },
  },
});
`);

    console.log('\n方法2: 使用后端 API');
    console.log(`
GET http://localhost:3000/api/v1/devices
`);

    // 4. 为路由器添加面板和端口
    console.log('========================================');
    console.log('4. 为路由器添加面板和端口');
    console.log('========================================\n');

    console.log('步骤1: 创建面板模板（可选，用于标准化）');
    console.log(`
POST http://localhost:3000/api/v1/panel-templates/create

{
  "name": "24口千兆路由器面板",
  "type": "NETWORK",
  "portCount": 24,
  "description": "标准24口千兆以太网面板",
  "portDefinitions": [
    // 端口定义数组
  ]
}
`);

    console.log('\n步骤2: 为路由器创建面板');
    console.log(`
POST http://localhost:3000/api/v1/panels/create

{
  "name": "GE0/0/0-23",
  "type": "NETWORK",
  "deviceId": "<路由器ID>",
  "templateId": "<模板ID，可选>"
}
`);

    console.log('\n步骤3: 为面板添加端口（通常在创建面板时自动创建）');
    console.log(`
// 端口会根据面板模板自动创建
// 或者手动创建:

POST http://localhost:3000/api/v1/ports/create

{
  "number": "0/0/1",
  "label": "GE0/0/1",
  "panelId": "<面板ID>",
  "portType": "RJ45",
  "status": "AVAILABLE"
}
`);

    // 5. 在路由器之间创建连接
    console.log('========================================');
    console.log('5. 在路由器之间创建连接');
    console.log('========================================\n');

    console.log('步骤1: 创建线缆');
    console.log(`
POST http://localhost:3000/api/v1/cables/create

{
  "label": "CAB-001",
  "type": "CAT6",  // 或者 FIBER_SM, FIBER_MM 等
  "length": 5.0,
  "color": "blue",
  "isBranched": false
}
`);

    console.log('\n步骤2: 创建线缆端点并连接到端口');
    console.log(`
// 创建端点A（连接到路由器1的端口）
POST http://localhost:3000/api/v1/cable-endpoints/create

{
  "cableId": "<线缆ID>",
  "portId": "<路由器1的端口ID>",
  "endType": "A"
}

// 创建端点B（连接到路由器2的端口）
POST http://localhost:3000/api/v1/cable-endpoints/create

{
  "cableId": "<线缆ID>",
  "portId": "<路由器2的端口ID>",
  "endType": "B"
}
`);

    console.log('\n或者使用一步到位的连接API（如果有的话）：');
    console.log(`
POST http://localhost:3000/api/v1/cables/connect

{
  "cableId": "<线缆ID>",
  "endpointA": {
    "portId": "<路由器1的端口ID>"
  },
  "endpointB": {
    "portId": "<路由器2的端口ID>"
  }
}
`);

    // 6. 数据模型说明
    console.log('========================================');
    console.log('6. 路由器相关数据模型');
    console.log('========================================\n');

    console.log('Device (设备表)');
    console.log('  - id: UUID');
    console.log('  - name: 设备名称');
    console.log('  - type: DeviceType (ROUTER, SWITCH, FIREWALL, 等)');
    console.log('  - model: 型号');
    console.log('  - serialNo: 序列号');
    console.log('  - uPosition: U位位置');
    console.log('  - uHeight: 占用U数');
    console.log('  - cabinetId: 所属机柜ID');
    console.log('  - panels: 关联的面板\n');

    console.log('Panel (面板表)');
    console.log('  - id: UUID');
    console.log('  - name: 面板名称');
    console.log('  - type: PanelType (NETWORK, POWER, 等)');
    console.log('  - shortId: 短ID（用于扫码）');
    console.log('  - deviceId: 所属设备ID');
    console.log('  - ports: 关联的端口\n');

    console.log('Port (端口表)');
    console.log('  - id: UUID');
    console.log('  - number: 端口编号');
    console.log('  - label: 端口标签');
    console.log('  - status: 状态 (AVAILABLE, OCCUPIED, RESERVED, FAULTY)');
    console.log('  - physicalStatus: 物理状态 (EMPTY, MODULE_ONLY, CONNECTED)');
    console.log('  - panelId: 所属面板ID');
    console.log('  - portType: 端口类型 (RJ45, SFP, QSFP, 等)');
    console.log('  - cableEndpoints: 连接的线缆端点');
    console.log('  - opticalModule: 关联的光模块\n');

    console.log('Cable (线缆表)');
    console.log('  - id: UUID');
    console.log('  - label: 线缆标签');
    console.log('  - type: CableType (CAT5E, CAT6, FIBER_SM, 等)');
    console.log('  - length: 长度（米）');
    console.log('  - color: 颜色');
    console.log('  - isBranched: 是否为分支线缆');
    console.log('  - endpoints: 线缆端点\n');

    console.log('CableEndpoint (线缆端点表)');
    console.log('  - id: UUID');
    console.log('  - shortId: 短ID（用于扫码）');
    console.log('  - cableId: 所属线缆ID');
    console.log('  - portId: 连接的端口ID');
    console.log('  - endType: 端点类型 (A, B1, B2, 等)\n');

    // 7. 查询示例
    console.log('========================================');
    console.log('7. 实用查询示例');
    console.log('========================================\n');

    console.log('查询所有路由器及其端口连接情况:');
    console.log(`
const routers = await prisma.device.findMany({
  where: { type: 'ROUTER' },
  include: {
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
          },
        },
      },
    },
  },
});
`);

    console.log('\n查询路由器之间的连接:');
    console.log(`
// 获取所有连接到路由器端口的线缆端点
const routerConnections = await prisma.cableEndpoint.findMany({
  where: {
    port: {
      panel: {
        device: {
          type: 'ROUTER',
        },
      },
    },
  },
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
});
`);

    console.log('\n查询特定路由器的所有连接:');
    console.log(`
const routerId = '<路由器ID>';
const connections = await prisma.cableEndpoint.findMany({
  where: {
    port: {
      panel: {
        deviceId: routerId,
      },
    },
  },
  include: {
    cable: true,
    port: {
      include: {
        panel: true,
      },
    },
  },
});
`);

  } catch (error) {
    console.error('操作失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

demonstrateRouterOperations();
