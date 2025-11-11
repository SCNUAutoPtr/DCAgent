import { PrismaClient } from '@prisma/client';
import cableGraphService from './src/graph/cableGraph';

const prisma = new PrismaClient();

// 从命令行参数读取是否清空 shortID 池
// 用法: npx tsx backend/clear-all-data.ts --clear-shortid
const shouldClearShortIdPool = process.argv.includes('--clear-shortid');

async function clearAllData() {
  try {
    console.log('开始清理所有业务数据...\n');
    if (shouldClearShortIdPool) {
      console.log('⚠️  将同时清空 shortID 池');
    } else {
      console.log('💡 将保留 shortID 池，仅重置为 GENERATED 状态');
    }
    console.log();

    // ==================== 1. 清理线缆相关数据 ====================
    console.log('【1/7】清理线缆数据...');

    // 1.1 获取所有线缆端点的 shortId
    const cableEndpoints = await prisma.cableEndpoint.findMany({
      select: { shortId: true },
    });
    const cableEndpointShortIds = cableEndpoints
      .map(ep => ep.shortId)
      .filter(id => id !== null) as number[];
    console.log(`  找到 ${cableEndpointShortIds.length} 个线缆端点的 shortID`);

    // 1.2 获取所有线缆ID，用于清理Neo4j
    const cables = await prisma.cable.findMany({
      select: { id: true },
    });
    console.log(`  找到 ${cables.length} 个线缆实例`);

    // 1.3 清理 Neo4j 中的线缆连接关系
    if (cables.length > 0) {
      console.log('  清理 Neo4j 中的线缆连接关系...');
      for (const cable of cables) {
        try {
          await cableGraphService.deleteConnection(cable.id);
        } catch (error) {
          // Neo4j 可能已经不存在该连接，忽略错误
        }
      }
      console.log(`  已清理 Neo4j 中的线缆连接`);
    }

    // 1.4 删除所有线缆端点
    const deletedEndpoints = await prisma.cableEndpoint.deleteMany({});
    console.log(`  已删除 ${deletedEndpoints.count} 个线缆端点`);

    // 1.5 删除所有线缆实例
    const deletedCables = await prisma.cable.deleteMany({});
    console.log(`  已删除 ${deletedCables.count} 个线缆实例`);

    // ==================== 2. 清理端口数据 ====================
    console.log('\n【2/7】清理端口数据...');
    const deletedPorts = await prisma.port.deleteMany({});
    console.log(`  已删除 ${deletedPorts.count} 个端口`);

    // ==================== 3. 清理面板数据 ====================
    console.log('\n【3/7】清理面板数据...');

    // 3.1 获取所有面板的 shortId
    const panels = await prisma.panel.findMany({
      select: { shortId: true },
    });
    const panelShortIds = panels
      .map(p => p.shortId)
      .filter(id => id !== null) as number[];
    console.log(`  找到 ${panelShortIds.length} 个面板的 shortID`);

    // 3.2 删除所有面板
    const deletedPanels = await prisma.panel.deleteMany({});
    console.log(`  已删除 ${deletedPanels.count} 个面板`);

    // ==================== 4. 清理设备数据 ====================
    console.log('\n【4/7】清理设备数据...');
    const deletedDevices = await prisma.device.deleteMany({});
    console.log(`  已删除 ${deletedDevices.count} 个设备`);

    // ==================== 5. 清理机柜数据 ====================
    console.log('\n【5/7】清理机柜数据...');

    // 5.1 获取所有机柜的 shortId
    const cabinets = await prisma.cabinet.findMany({
      select: { shortId: true },
    });
    const cabinetShortIds = cabinets
      .map(c => c.shortId)
      .filter(id => id !== null) as number[];
    console.log(`  找到 ${cabinetShortIds.length} 个机柜的 shortID`);

    // 5.2 删除所有机柜
    const deletedCabinets = await prisma.cabinet.deleteMany({});
    console.log(`  已删除 ${deletedCabinets.count} 个机柜`);

    // ==================== 6. 清理机房和数据中心 ====================
    console.log('\n【6/7】清理机房和数据中心...');
    const deletedRooms = await prisma.room.deleteMany({});
    console.log(`  已删除 ${deletedRooms.count} 个机房`);

    const deletedDataCenters = await prisma.dataCenter.deleteMany({});
    console.log(`  已删除 ${deletedDataCenters.count} 个数据中心`);

    // ==================== 7. 处理 shortID 池 ====================
    console.log('\n【7/7】处理 shortID 池...');

    // 合并所有需要处理的 shortID
    const allShortIds = [
      ...cableEndpointShortIds,
      ...panelShortIds,
      ...cabinetShortIds,
    ];

    if (shouldClearShortIdPool) {
      // 模式1：完全清空 shortID 池
      const deletedAllocations = await prisma.globalShortIdAllocation.deleteMany({});
      console.log(`  已删除 ${deletedAllocations.count} 个全局 shortID 分配记录`);

      const deletedShortIds = await prisma.shortIdPool.deleteMany({});
      console.log(`  已删除 ${deletedShortIds.count} 个 shortID 池记录`);

      console.log('\n✅ 所有数据清理完成（包括 shortID 池）！');
    } else {
      // 模式2：保留 shortID 池，重置为 GENERATED 状态
      if (allShortIds.length > 0) {
        const updatedPool = await prisma.shortIdPool.updateMany({
          where: {
            shortId: { in: allShortIds },
          },
          data: {
            status: 'GENERATED',
            entityId: null,
            entityType: null,
          },
        });
        console.log(`  已重置 ${updatedPool.count} 个 shortID 为 GENERATED 状态`);
      }

      // 清理孤儿记录
      const orphanedCleaned = await prisma.shortIdPool.updateMany({
        where: {
          status: 'BOUND',
          entityId: '',
        },
        data: {
          status: 'GENERATED',
          entityType: null,
          entityId: null,
        },
      });
      if (orphanedCleaned.count > 0) {
        console.log(`  已清理 ${orphanedCleaned.count} 个孤儿 shortID 记录`);
      }

      // 清理 globalShortIdAllocation 中的业务数据分配记录
      const deletedAllocations = await prisma.globalShortIdAllocation.deleteMany({
        where: {
          entityType: {
            in: ['CABINET', 'PANEL', 'CABLE_ENDPOINT'],
          },
        },
      });
      console.log(`  已删除 ${deletedAllocations.count} 个业务数据 shortID 分配记录`);

      const orphanedAllocations = await prisma.globalShortIdAllocation.deleteMany({
        where: {
          entityId: '',
        },
      });
      if (orphanedAllocations.count > 0) {
        console.log(`  已清理 ${orphanedAllocations.count} 个孤儿 shortID 分配记录`);
      }

      console.log('\n✅ 所有业务数据清理完成，shortID 池已重置！');
    }

    console.log('\n📊 清理汇总:');
    console.log(`  - 数据中心: ${deletedDataCenters.count}`);
    console.log(`  - 机房: ${deletedRooms.count}`);
    console.log(`  - 机柜: ${deletedCabinets.count}`);
    console.log(`  - 设备: ${deletedDevices.count}`);
    console.log(`  - 面板: ${deletedPanels.count}`);
    console.log(`  - 端口: ${deletedPorts.count}`);
    console.log(`  - 线缆: ${deletedCables.count}`);
    console.log(`  - 线缆端点: ${deletedEndpoints.count}`);

    if (shouldClearShortIdPool) {
      console.log('\n💡 shortID 池已完全清空，需要重新生成标签');
    } else {
      console.log(`  - 重置 shortID: ${allShortIds.length}`);
      console.log('\n💡 shortID 池已保留并重置为 GENERATED 状态，可以继续使用');
    }

  } catch (error) {
    console.error('❌ 清理失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearAllData()
  .then(() => {
    console.log('\n脚本执行成功');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n脚本执行失败:', error);
    process.exit(1);
  });
