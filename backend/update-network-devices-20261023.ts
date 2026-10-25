import { PrismaClient, IpStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 根据 2026-10-23 巡检数据更新网络设备型号和管理 IP
 *
 * 数据来源：CiderLLM 仓库 network/console-survey/*_20261023.txt
 */

// 设备映射数据（从巡检结果整理）
const deviceUpdates: Array<{
  name: string;
  model?: string;
  managementIp?: string;
  notes?: string;
}> = [
  { name: '445A-U6', model: 'S5735S-L24T4X-QA2', managementIp: '192.168.10.31' },
  { name: '445A-U9', model: 'S5735S-L24T4X-QA2', managementIp: '192.168.10.32' },
  { name: '445A-U12', model: 'S5735S-L24T4X-QA2', managementIp: '192.168.10.33' },
  { name: '445B-U6', model: 'S5735S-L24T4X-QA2', managementIp: '192.168.10.41' },
  { name: '445B-U8', model: 'S5735S-L24T4X-QA2', managementIp: '192.168.10.42' },
  { name: '445B-U11', model: 'S5735S-L24T4X-QA2', managementIp: '192.168.10.43' },
  { name: '446stack', model: 'S5735S-L24T4X-QA2', managementIp: '192.168.10.22', notes: '三台堆叠（slot0/1/2）' },
  { name: 'F13', model: 'S5735S-L24T4X-QA2', managementIp: '192.168.10.11' },
  { name: 'F10', model: 'S6730S-S24X6Q-A', managementIp: '192.168.10.12' },
  { name: 'A38', model: 'S5735S-L24T4X-QA2', managementIp: '192.168.10.13' },
  // F23 在 issue 中提到但巡检数据中没有型号和 IP，仅检查是否存在
  { name: 'F23' },
];

const VENDOR = '华为';
const MANAGEMENT_SUBNET = '192.168.10.0/24';

async function main() {
  console.log('========================================');
  console.log('更新网络设备型号和管理 IP');
  console.log('数据来源：2026-10-23 巡检');
  console.log('========================================\n');

  // 0. 清理所有设备型号中的"华为"前缀
  console.log('0. 清理设备型号中的"华为"前缀...');
  const devicesWithVendorPrefix = await prisma.device.findMany({
    where: {
      model: {
        startsWith: '华为',
      },
    },
  });

  if (devicesWithVendorPrefix.length > 0) {
    console.log(`   找到 ${devicesWithVendorPrefix.length} 台设备的型号带有"华为"前缀`);
    for (const device of devicesWithVendorPrefix) {
      const oldModel = device.model!;
      // 去掉"华为"、"华为 "前缀
      const newModel = oldModel.replace(/^华为\s*/, '');
      console.log(`   ${device.name}: "${oldModel}" -> "${newModel}"`);
      await prisma.device.update({
        where: { id: device.id },
        data: { model: newModel },
      });
    }
    console.log(`   ✅ 已清理 ${devicesWithVendorPrefix.length} 台设备的型号`);
  } else {
    console.log('   ✅ 没有需要清理的型号');
  }
  console.log('');

  // 1. 检查或创建管理网段
  console.log('1. 检查管理网段...');
  let managementSubnet = await prisma.ipSubnet.findFirst({
    where: {
      network: '192.168.10.0',
      cidr: 24,
    },
  });

  if (!managementSubnet) {
    console.log('   管理网段不存在，创建中...');
    managementSubnet = await prisma.ipSubnet.create({
      data: {
        name: '管理网段',
        network: '192.168.10.0',
        cidr: 24,
        gateway: '192.168.10.1',
        description: '设备管理网络 192.168.10.0/24',
      },
    });
    console.log(`   ✅ 已创建管理网段: ${managementSubnet.name}`);
  } else {
    console.log(`   ✅ 管理网段已存在: ${managementSubnet.name}`);
  }

  console.log('');

  // 2. 更新设备信息
  console.log('2. 更新设备型号和管理 IP...\n');

  let successCount = 0;
  let notFoundCount = 0;
  let skippedCount = 0;

  for (const deviceData of deviceUpdates) {
    console.log(`处理设备: ${deviceData.name}`);

    // 查找设备（按名称模糊匹配）
    const device = await prisma.device.findFirst({
      where: {
        name: {
          contains: deviceData.name,
          mode: 'insensitive',
        },
        type: 'SWITCH', // 限制为交换机类型
      },
      include: {
        ipAddresses: true,
        cabinet: {
          include: {
            room: true,
          },
        },
      },
    });

    if (!device) {
      console.log(`   ⚠️  未找到设备: ${deviceData.name}`);
      notFoundCount++;
      console.log('');
      continue;
    }

    console.log(`   找到设备: ${device.name} (${device.id})`);
    console.log(`   当前位置: ${device.cabinet.room.name} > ${device.cabinet.name}`);

    // 更新设备型号（如果提供了型号数据）
    let updated = false;
    if (deviceData.model) {
      if (device.model !== deviceData.model) {
        console.log(`   更新型号: "${device.model || '(空)'}" -> "${deviceData.model}"`);
        await prisma.device.update({
          where: { id: device.id },
          data: { model: deviceData.model },
        });
        updated = true;
      } else {
        console.log(`   型号已正确: ${device.model}`);
      }
    } else {
      console.log(`   型号: ${device.model || '(未设置)'} - 无巡检数据`);
    }

    // 如果没有提供管理 IP，跳过 IP 配置
    if (!deviceData.managementIp) {
      console.log(`   无管理 IP 数据，跳过`);
      if (!updated) {
        skippedCount++;
      } else {
        successCount++;
      }
      console.log('');
      continue;
    }

    // 检查是否已有管理 IP
    const existingMgmtIp = device.ipAddresses.find(ip => ip.address === deviceData.managementIp);

    if (existingMgmtIp) {
      console.log(`   管理 IP 已存在: ${existingMgmtIp.address}`);
      if (!updated) {
        skippedCount++;
      } else {
        successCount++;
      }
      console.log('');
      continue;
    }

    // 查找或创建 IP 地址记录
    let ipAddress = await prisma.ipAddress.findUnique({
      where: { address: deviceData.managementIp },
    });

    if (!ipAddress) {
      // IP 不存在，创建新记录
      console.log(`   创建 IP 地址记录: ${deviceData.managementIp}`);
      ipAddress = await prisma.ipAddress.create({
        data: {
          address: deviceData.managementIp,
          subnetId: managementSubnet.id,
          status: IpStatus.ALLOCATED,
          deviceId: device.id,
          hostname: device.name,
          description: deviceData.notes ? `${device.name} 管理地址 - ${deviceData.notes}` : `${device.name} 管理地址`,
        },
      });
      console.log(`   ✅ 已创建并绑定管理 IP: ${ipAddress.address}`);
    } else {
      // IP 已存在，更新绑定
      if (ipAddress.deviceId && ipAddress.deviceId !== device.id) {
        console.log(`   ⚠️  IP ${deviceData.managementIp} 已绑定到其他设备，跳过`);
        if (!updated) {
          skippedCount++;
        } else {
          successCount++;
        }
        console.log('');
        continue;
      }

      console.log(`   更新 IP 地址绑定: ${deviceData.managementIp}`);
      await prisma.ipAddress.update({
        where: { id: ipAddress.id },
        data: {
          status: IpStatus.ALLOCATED,
          deviceId: device.id,
          hostname: device.name,
          description: deviceData.notes ? `${device.name} 管理地址 - ${deviceData.notes}` : `${device.name} 管理地址`,
        },
      });
      console.log(`   ✅ 已绑定管理 IP: ${ipAddress.address}`);
    }

    successCount++;
    console.log('');
  }

  // 3. 统计结果
  console.log('========================================');
  console.log('更新完成');
  console.log('========================================');
  console.log(`成功更新: ${successCount} 台设备`);
  console.log(`未找到: ${notFoundCount} 台设备`);
  console.log(`无需更新: ${skippedCount} 台设备`);
  console.log('');

  if (notFoundCount > 0) {
    console.log('⚠️  部分设备未找到，可能需要手动检查设备名称是否正确');
  }

  console.log('\n提示：');
  console.log('- 当前数据库设计中 Device.model 字段为字符串，不存在独立的型号表');
  console.log('- 厂商信息（华为）未在数据库中存储，仅通过清理型号前缀实现标准化');
  console.log('- 446stack 是三台堆叠设备，型号字段目前只能记录单个型号');
  console.log('- 序列号需要通过后续巡检（display esn / display elabel brief）获取');
  console.log('- 考虑开发"导入巡检文件"功能自动化此流程');
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
