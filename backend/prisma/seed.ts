import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始创建测试数据...\n');

  // 1. 创建数据中心
  console.log('📍 创建数据中心...');
  const dc1 = await prisma.dataCenter.create({
    data: {
      name: '北京数据中心',
      location: '北京市朝阳区',
    },
  });
  console.log(`✅ 已创建: ${dc1.name}`);

  const dc2 = await prisma.dataCenter.create({
    data: {
      name: '上海数据中心',
      location: '上海市浦东新区',
    },
  });
  console.log(`✅ 已创建: ${dc2.name}\n`);

  // 2. 创建机房
  console.log('🏢 创建机房...');
  const room1 = await prisma.room.create({
    data: {
      name: 'A区机房',
      floor: '3F',
      dataCenterId: dc1.id,
    },
  });
  console.log(`✅ 已创建: ${room1.name} (${dc1.name})`);

  const room2 = await prisma.room.create({
    data: {
      name: 'B区机房',
      floor: '4F',
      dataCenterId: dc1.id,
    },
  });
  console.log(`✅ 已创建: ${room2.name} (${dc1.name})`);

  const room3 = await prisma.room.create({
    data: {
      name: 'C区机房',
      floor: '2F',
      dataCenterId: dc2.id,
    },
  });
  console.log(`✅ 已创建: ${room3.name} (${dc2.name})\n`);

  // 3. 创建机柜
  console.log('📦 创建机柜...');
  const cabinet1 = await prisma.cabinet.create({
    data: {
      name: 'A-01',
      position: '第一排第一列',
      height: 42,
      roomId: room1.id,
    },
  });
  console.log(`✅ 已创建: ${cabinet1.name} (${room1.name})`);

  const cabinet2 = await prisma.cabinet.create({
    data: {
      name: 'A-02',
      position: '第一排第二列',
      height: 42,
      roomId: room1.id,
    },
  });
  console.log(`✅ 已创建: ${cabinet2.name} (${room1.name})`);

  const cabinet3 = await prisma.cabinet.create({
    data: {
      name: 'B-01',
      position: '第一排第一列',
      height: 42,
      roomId: room2.id,
    },
  });
  console.log(`✅ 已创建: ${cabinet3.name} (${room2.name})\n`);

  // 4. 创建设备
  console.log('💻 创建设备...');

  // 服务器
  const server1 = await prisma.device.create({
    data: {
      name: 'WEB-Server-01',
      type: 'SERVER',
      model: 'Dell PowerEdge R740',
      serialNo: 'SN-WEB-001',
      uPosition: 1,
      uHeight: 2,
      cabinetId: cabinet1.id,
    },
  });
  console.log(`✅ 已创建: ${server1.name} (${server1.type})`);

  const server2 = await prisma.device.create({
    data: {
      name: 'DB-Server-01',
      type: 'SERVER',
      model: 'Dell PowerEdge R740',
      serialNo: 'SN-DB-001',
      uPosition: 3,
      uHeight: 2,
      cabinetId: cabinet1.id,
    },
  });
  console.log(`✅ 已创建: ${server2.name} (${server2.type})`);

  const server3 = await prisma.device.create({
    data: {
      name: 'APP-Server-01',
      type: 'SERVER',
      model: 'HP ProLiant DL380',
      serialNo: 'SN-APP-001',
      uPosition: 5,
      uHeight: 2,
      cabinetId: cabinet1.id,
    },
  });
  console.log(`✅ 已创建: ${server3.name} (${server3.type})`);

  // 交换机
  const switch1 = await prisma.device.create({
    data: {
      name: 'Core-Switch-01',
      type: 'SWITCH',
      model: 'Cisco Catalyst 9300',
      serialNo: 'SN-SW-001',
      uPosition: 10,
      uHeight: 1,
      cabinetId: cabinet1.id,
    },
  });
  console.log(`✅ 已创建: ${switch1.name} (${switch1.type})`);

  const switch2 = await prisma.device.create({
    data: {
      name: 'Access-Switch-01',
      type: 'SWITCH',
      model: 'Cisco Catalyst 2960',
      serialNo: 'SN-SW-002',
      uPosition: 11,
      uHeight: 1,
      cabinetId: cabinet1.id,
    },
  });
  console.log(`✅ 已创建: ${switch2.name} (${switch2.type})`);

  // 路由器
  const router1 = await prisma.device.create({
    data: {
      name: 'Border-Router-01',
      type: 'ROUTER',
      model: 'Cisco ASR 1001',
      serialNo: 'SN-RTR-001',
      uPosition: 1,
      uHeight: 2,
      cabinetId: cabinet2.id,
    },
  });
  console.log(`✅ 已创建: ${router1.name} (${router1.type})`);

  // 防火墙
  const firewall1 = await prisma.device.create({
    data: {
      name: 'FW-01',
      type: 'FIREWALL',
      model: 'Palo Alto PA-3220',
      serialNo: 'SN-FW-001',
      uPosition: 3,
      uHeight: 1,
      cabinetId: cabinet2.id,
    },
  });
  console.log(`✅ 已创建: ${firewall1.name} (${firewall1.type})`);

  // 存储
  const storage1 = await prisma.device.create({
    data: {
      name: 'Storage-Array-01',
      type: 'STORAGE',
      model: 'NetApp FAS8200',
      serialNo: 'SN-STO-001',
      uPosition: 5,
      uHeight: 4,
      cabinetId: cabinet2.id,
    },
  });
  console.log(`✅ 已创建: ${storage1.name} (${storage1.type})`);

  // PDU
  const pdu1 = await prisma.device.create({
    data: {
      name: 'PDU-A-01',
      type: 'PDU',
      model: 'APC AP8941',
      serialNo: 'SN-PDU-001',
      uPosition: 40,
      uHeight: 1,
      cabinetId: cabinet1.id,
    },
  });
  console.log(`✅ 已创建: ${pdu1.name} (${pdu1.type})\n`);

  // 5. 创建面板
  console.log('🔌 创建面板...');

  // 交换机面板
  const panel1 = await prisma.panel.create({
    data: {
      name: 'eth0',
      type: 'NETWORK',
      deviceId: switch1.id,
    },
  });
  console.log(`✅ 已创建: ${panel1.name} (${switch1.name})`);

  const panel2 = await prisma.panel.create({
    data: {
      name: 'eth1',
      type: 'NETWORK',
      deviceId: switch2.id,
    },
  });
  console.log(`✅ 已创建: ${panel2.name} (${switch2.name})`);

  // 服务器面板
  const panel3 = await prisma.panel.create({
    data: {
      name: 'NIC0',
      type: 'NETWORK',
      deviceId: server1.id,
    },
  });
  console.log(`✅ 已创建: ${panel3.name} (${server1.name})`);

  const panel4 = await prisma.panel.create({
    data: {
      name: 'NIC0',
      type: 'NETWORK',
      deviceId: server2.id,
    },
  });
  console.log(`✅ 已创建: ${panel4.name} (${server2.name})`);

  // 路由器面板
  const panel5 = await prisma.panel.create({
    data: {
      name: 'GigabitEthernet0/0',
      type: 'NETWORK',
      deviceId: router1.id,
    },
  });
  console.log(`✅ 已创建: ${panel5.name} (${router1.name})`);

  // PDU电源面板
  const panel6 = await prisma.panel.create({
    data: {
      name: 'Power-Out',
      type: 'POWER',
      deviceId: pdu1.id,
    },
  });
  console.log(`✅ 已创建: ${panel6.name} (${pdu1.name})\n`);

  // 6. 创建端口
  console.log('🔗 创建端口...');

  // 为交换机 Core-Switch-01 创建 48 个端口
  const switch1Ports = [];
  for (let i = 1; i <= 48; i++) {
    const port = await prisma.port.create({
      data: {
        number: String(i),
        label: `Port-${i}`,
        status: i <= 10 ? 'OCCUPIED' : 'AVAILABLE',
        panelId: panel1.id,
      },
    });
    switch1Ports.push(port);
  }
  console.log(`✅ 已创建: ${switch1Ports.length} 个端口 (${switch1.name} - ${panel1.name})`);

  // 为交换机 Access-Switch-01 创建 24 个端口
  const switch2Ports = [];
  for (let i = 1; i <= 24; i++) {
    const port = await prisma.port.create({
      data: {
        number: String(i),
        label: `Port-${i}`,
        status: i <= 5 ? 'OCCUPIED' : 'AVAILABLE',
        panelId: panel2.id,
      },
    });
    switch2Ports.push(port);
  }
  console.log(`✅ 已创建: ${switch2Ports.length} 个端口 (${switch2.name} - ${panel2.name})`);

  // 为服务器创建端口
  const server1Port1 = await prisma.port.create({
    data: {
      number: '1',
      label: 'eth0',
      status: 'OCCUPIED',
      panelId: panel3.id,
    },
  });
  console.log(`✅ 已创建: 1 个端口 (${server1.name} - ${panel3.name})`);

  const server2Port1 = await prisma.port.create({
    data: {
      number: '1',
      label: 'eth0',
      status: 'OCCUPIED',
      panelId: panel4.id,
    },
  });
  console.log(`✅ 已创建: 1 个端口 (${server2.name} - ${panel4.name})`);

  // 为路由器创建端口
  const routerPorts = [];
  for (let i = 0; i <= 3; i++) {
    const port = await prisma.port.create({
      data: {
        number: String(i),
        label: `GigabitEthernet0/0/${i}`,
        status: i === 0 ? 'OCCUPIED' : 'AVAILABLE',
        panelId: panel5.id,
      },
    });
    routerPorts.push(port);
  }
  console.log(`✅ 已创建: ${routerPorts.length} 个端口 (${router1.name} - ${panel5.name})`);

  // 为 PDU 创建 8 个电源端口
  const pduPorts = [];
  for (let i = 1; i <= 8; i++) {
    const port = await prisma.port.create({
      data: {
        number: String(i),
        label: `Outlet-${i}`,
        status: i <= 5 ? 'OCCUPIED' : 'AVAILABLE',
        panelId: panel6.id,
      },
    });
    pduPorts.push(port);
  }
  console.log(`✅ 已创建: ${pduPorts.length} 个端口 (${pdu1.name} - ${panel6.name})\n`);

  // 7. 创建线缆连接
  console.log('🔗 创建线缆连接...');

  // 服务器1 连接到 交换机1 端口1
  const cable1 = await prisma.cable.create({
    data: {
      label: 'CAB-001',
      type: 'CAT6A',
      length: 3,
      color: '蓝色',
      notes: 'WEB服务器到核心交换机',
      endpoints: {
        create: [
          {
            portId: server1Port1.id,
            endType: 'A',
          },
          {
            portId: switch1Ports[0].id,
            endType: 'B',
          },
        ],
      },
    },
  });
  console.log(`✅ 已创建: ${cable1.label} (${server1.name} <-> ${switch1.name})`);

  // 服务器2 连接到 交换机1 端口2
  const cable2 = await prisma.cable.create({
    data: {
      label: 'CAB-002',
      type: 'CAT6A',
      length: 3,
      color: '蓝色',
      notes: '数据库服务器到核心交换机',
      endpoints: {
        create: [
          {
            portId: server2Port1.id,
            endType: 'A',
          },
          {
            portId: switch1Ports[1].id,
            endType: 'B',
          },
        ],
      },
    },
  });
  console.log(`✅ 已创建: ${cable2.label} (${server2.name} <-> ${switch1.name})`);

  console.log('\n✨ 测试数据创建完成！\n');

  // 显示统计信息
  console.log('📊 统计信息:');
  console.log(`   数据中心: ${await prisma.dataCenter.count()} 个`);
  console.log(`   机房: ${await prisma.room.count()} 个`);
  console.log(`   机柜: ${await prisma.cabinet.count()} 个`);
  console.log(`   设备: ${await prisma.device.count()} 个`);
  console.log(`   面板: ${await prisma.panel.count()} 个`);
  console.log(`   端口: ${await prisma.port.count()} 个`);
  console.log(`   线缆: ${await prisma.cable.count()} 条`);
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
