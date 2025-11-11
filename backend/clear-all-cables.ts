import { PrismaClient } from '@prisma/client';
import cableGraphService from './src/graph/cableGraph';

const prisma = new PrismaClient();

async function clearAllCables() {
  try {
    console.log('开始清理所有线缆数据...');

    // 1. 获取所有线缆端点的 shortId
    const cableEndpoints = await prisma.cableEndpoint.findMany({
      select: { shortId: true },
    });
    const shortIds = cableEndpoints.map(ep => ep.shortId).filter(id => id !== null);
    console.log(`找到 ${shortIds.length} 个线缆端点的 shortID`);

    // 2. 获取所有线缆ID，用于清理Neo4j
    const cables = await prisma.cable.findMany({
      select: { id: true },
    });
    console.log(`找到 ${cables.length} 个线缆实例`);

    // 3. 清理 Neo4j 中的线缆连接关系
    console.log('清理 Neo4j 中的线缆连接关系...');
    for (const cable of cables) {
      try {
        await cableGraphService.deleteConnection(cable.id);
        console.log(`  - 已删除线缆 ${cable.id} 的 Neo4j 连接`);
      } catch (error) {
        console.warn(`  - 删除线缆 ${cable.id} 的 Neo4j 连接失败:`, error);
      }
    }

    // 4. 删除所有线缆端点
    const deletedEndpoints = await prisma.cableEndpoint.deleteMany({});
    console.log(`已删除 ${deletedEndpoints.count} 个线缆端点`);

    // 5. 删除所有线缆实例
    const deletedCables = await prisma.cable.deleteMany({});
    console.log(`已删除 ${deletedCables.count} 个线缆实例`);

    // 6. 释放所有 shortID 回到池中
    if (shortIds.length > 0) {
      // 更新 shortIdPool，将这些 shortID 的状态改为 GENERATED，清除 entityId 和 entityType
      const updatedPool = await prisma.shortIdPool.updateMany({
        where: {
          shortId: { in: shortIds },
        },
        data: {
          status: 'GENERATED',
          entityId: null,
          entityType: null,
        },
      });
      console.log(`已释放 ${updatedPool.count} 个 shortID 回到池中`);
    }

    // 7. 删除 globalShortIdAllocation 中的线缆端点分配记录
    const deletedAllocations = await prisma.globalShortIdAllocation.deleteMany({
      where: {
        entityType: 'CABLE_ENDPOINT',
      },
    });
    console.log(`已删除 ${deletedAllocations.count} 个全局 shortID 分配记录`);

    console.log('\n✅ 所有线缆数据清理完成（包括 Neo4j）！');
  } catch (error) {
    console.error('❌ 清理失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearAllCables()
  .then(() => {
    console.log('\n脚本执行成功');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n脚本执行失败:', error);
    process.exit(1);
  });
