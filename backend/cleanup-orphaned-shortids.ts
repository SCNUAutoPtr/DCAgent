import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupOrphanedShortIds() {
  try {
    console.log('开始清理孤儿 shortID 记录...\n');

    // 1. 查找所有孤儿记录（entityId 是空字符串的 BOUND 状态记录）
    const orphanedRecords = await prisma.shortIdPool.findMany({
      where: {
        status: 'BOUND',
        entityId: '',  // 空字符串
      },
    });

    console.log(`找到 ${orphanedRecords.length} 个孤儿 shortID 记录:`);
    orphanedRecords.forEach(record => {
      console.log(`  - shortId: ${record.shortId}, entityType: ${record.entityType}, entityId: "${record.entityId}"`);
    });

    // 2. 清理 shortIdPool 中的孤儿记录
    if (orphanedRecords.length > 0) {
      const updated = await prisma.shortIdPool.updateMany({
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
      console.log(`\n已将 ${updated.count} 个孤儿记录重置为 GENERATED 状态`);
    }

    // 3. 清理 globalShortIdAllocation 中的孤儿记录
    const orphanedAllocations = await prisma.globalShortIdAllocation.findMany({
      where: {
        entityId: '',
      },
    });

    if (orphanedAllocations.length > 0) {
      console.log(`\n找到 ${orphanedAllocations.length} 个孤儿 globalShortIdAllocation 记录`);
      const deletedAllocations = await prisma.globalShortIdAllocation.deleteMany({
        where: {
          entityId: '',
        },
      });
      console.log(`已删除 ${deletedAllocations.count} 个孤儿 globalShortIdAllocation 记录`);
    }

    console.log('\n✅ 孤儿 shortID 记录清理完成！');
  } catch (error) {
    console.error('❌ 清理失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOrphanedShortIds()
  .then(() => {
    console.log('\n脚本执行成功');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n脚本执行失败:', error);
    process.exit(1);
  });
