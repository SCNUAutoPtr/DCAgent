/**
 * 设备型号初始化和端口补全脚本
 *
 * 用法：
 * 1. 初始化预设设备型号：npx ts-node src/scripts/initializeDeviceModels.ts init
 * 2. 为指定设备补全端口：npx ts-node src/scripts/initializeDeviceModels.ts complete <deviceId>
 * 3. 为所有交换机补全端口：npx ts-node src/scripts/initializeDeviceModels.ts complete-all
 */

import prisma from '../utils/prisma';
import deviceModelService from '../services/deviceModelService';
import portCompletionService from '../services/portCompletionService';

async function initializeDeviceModels() {
  console.log('开始初始化设备型号...');

  try {
    await deviceModelService.initializePresetModels();
    console.log('设备型号初始化完成');

    // 显示已创建的型号
    const models = await prisma.deviceModel.findMany({
      select: {
        name: true,
        vendor: true,
        description: true,
        isStackable: true,
      },
    });

    console.log('\n已创建的设备型号:');
    models.forEach((model) => {
      console.log(`  - ${model.name} (${model.vendor}): ${model.description}`);
      if (model.isStackable) {
        console.log(`    支持堆叠`);
      }
    });
  } catch (error: any) {
    console.error('初始化失败:', error.message);
    process.exit(1);
  }
}

async function completeDevicePorts(deviceId: string) {
  console.log(`\n为设备 ${deviceId} 补全端口...`);

  try {
    const result = await portCompletionService.completeDevicePorts(deviceId);

    console.log('\n补全结果:');
    console.log(`  设备: ${result.device.name}`);
    console.log(`  创建面板数: ${result.panelsCreated}`);
    console.log(`  新增端口数: ${result.portsAdded}`);
    console.log(`  保留端口数: ${result.portsPreserved}`);

    if (result.stackMembersCreated) {
      console.log(`  堆叠成员数: ${result.stackMembersCreated}`);
    }
  } catch (error: any) {
    console.error('补全端口失败:', error.message);
    process.exit(1);
  }
}

async function completeAllSwitches() {
  console.log('\n为所有交换机补全端口...');

  try {
    // 获取所有设置了型号的交换机
    const devices = await prisma.device.findMany({
      where: {
        type: 'SWITCH',
        deviceModelId: { not: null },
      },
      select: {
        id: true,
        name: true,
        deviceModel: {
          select: { name: true },
        },
      },
    });

    if (devices.length === 0) {
      console.log('没有找到设置了型号的交换机');
      return;
    }

    console.log(`找到 ${devices.length} 个交换机:`);
    devices.forEach((device) => {
      console.log(`  - ${device.name} (型号: ${device.deviceModel?.name})`);
    });

    console.log('\n开始批量补全...');
    const deviceIds = devices.map((d) => d.id);
    const result = await portCompletionService.batchCompleteDevicePorts(deviceIds);

    console.log('\n批量补全完成:');
    console.log(`  成功: ${result.results.length} 个设备`);
    console.log(`  失败: ${result.errors.length} 个设备`);

    if (result.errors.length > 0) {
      console.log('\n失败详情:');
      result.errors.forEach((error) => {
        console.log(`  - ${error.deviceId}: ${error.error}`);
      });
    }

    if (result.results.length > 0) {
      const totalPortsAdded = result.results.reduce((sum, r) => sum + r.portsAdded, 0);
      const totalPortsPreserved = result.results.reduce((sum, r) => sum + r.portsPreserved, 0);
      const totalPanelsCreated = result.results.reduce((sum, r) => sum + r.panelsCreated, 0);

      console.log('\n汇总:');
      console.log(`  创建面板总数: ${totalPanelsCreated}`);
      console.log(`  新增端口总数: ${totalPortsAdded}`);
      console.log(`  保留端口总数: ${totalPortsPreserved}`);
    }
  } catch (error: any) {
    console.error('批量补全失败:', error.message);
    process.exit(1);
  }
}

async function assignDeviceModel(deviceName: string, modelName: string) {
  console.log(`\n为设备 ${deviceName} 分配型号 ${modelName}...`);

  try {
    // 查找设备
    const device = await prisma.device.findFirst({
      where: { name: { contains: deviceName } },
    });

    if (!device) {
      console.error(`未找到设备: ${deviceName}`);
      process.exit(1);
    }

    // 查找型号
    const deviceModel = await prisma.deviceModel.findUnique({
      where: { name: modelName },
    });

    if (!deviceModel) {
      console.error(`未找到设备型号: ${modelName}`);
      process.exit(1);
    }

    // 更新设备型号
    await prisma.device.update({
      where: { id: device.id },
      data: { deviceModelId: deviceModel.id },
    });

    console.log(`已为设备 ${device.name} 分配型号 ${deviceModel.name}`);

    // 补全端口
    await completeDevicePorts(device.id);
  } catch (error: any) {
    console.error('分配型号失败:', error.message);
    process.exit(1);
  }
}

async function createStackMembers(deviceName: string, memberCount: number) {
  console.log(`\n为设备 ${deviceName} 创建 ${memberCount} 个堆叠成员...`);

  try {
    const device = await prisma.device.findFirst({
      where: { name: { contains: deviceName } },
      include: { deviceModel: true },
    });

    if (!device) {
      console.error(`未找到设备: ${deviceName}`);
      process.exit(1);
    }

    if (!device.deviceModel?.isStackable) {
      console.error(`设备型号 ${device.deviceModel?.name} 不支持堆叠`);
      process.exit(1);
    }

    for (let i = 0; i < memberCount; i++) {
      const member = await portCompletionService.createStackMember(device.id, i, 'active');
      console.log(`  已创建堆叠成员 ${i}`);
    }

    // 补全端口
    await completeDevicePorts(device.id);
  } catch (error: any) {
    console.error('创建堆叠成员失败:', error.message);
    process.exit(1);
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log('用法:');
    console.log('  npx ts-node src/scripts/initializeDeviceModels.ts init');
    console.log('  npx ts-node src/scripts/initializeDeviceModels.ts complete <deviceId>');
    console.log('  npx ts-node src/scripts/initializeDeviceModels.ts complete-all');
    console.log('  npx ts-node src/scripts/initializeDeviceModels.ts assign <deviceName> <modelName>');
    console.log('  npx ts-node src/scripts/initializeDeviceModels.ts stack <deviceName> <memberCount>');
    process.exit(0);
  }

  try {
    switch (command) {
      case 'init':
        await initializeDeviceModels();
        break;

      case 'complete':
        if (args.length < 2) {
          console.error('请提供设备ID');
          process.exit(1);
        }
        await completeDevicePorts(args[1]);
        break;

      case 'complete-all':
        await completeAllSwitches();
        break;

      case 'assign':
        if (args.length < 3) {
          console.error('请提供设备名称和型号名称');
          process.exit(1);
        }
        await assignDeviceModel(args[1], args[2]);
        break;

      case 'stack':
        if (args.length < 3) {
          console.error('请提供设备名称和成员数量');
          process.exit(1);
        }
        await createStackMembers(args[1], parseInt(args[2]));
        break;

      default:
        console.error(`未知命令: ${command}`);
        process.exit(1);
    }

    await prisma.$disconnect();
  } catch (error: any) {
    console.error('执行失败:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
