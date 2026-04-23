import prisma from '../utils/prisma';

/**
 * 将 GlobalShortIDAllocation 的数据迁移到 ShortIDPool
 * 执行命令: npx tsx src/scripts/mergeGlobalShortIdToPool.ts
 */

async function mergeGlobalShortIdToPool() {
  console.log('========================================');
  console.log('开始迁移 GlobalShortIDAllocation → ShortIDPool');
  console.log('========================================\n');

  try {
    console.log('GlobalShortIdAllocation 已废弃，当前无需迁移数据');

    const poolCount = await prisma.shortIdPool.count();
    const boundCount = await prisma.shortIdPool.count({
      where: { status: 'BOUND' }
    });

    console.log(`ShortIDPool 总记录数: ${poolCount}`);
    console.log(`ShortIDPool BOUND 状态记录数: ${boundCount}`);
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行迁移
mergeGlobalShortIdToPool()
  .then(() => {
    console.log('\n🎉 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 脚本执行失败:', error);
    process.exit(1);
  });
