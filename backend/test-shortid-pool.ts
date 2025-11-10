/**
 * ShortID池跟踪功能测试脚本
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testShortIdPoolTracking() {
  console.log('=== ShortID池跟踪功能测试 ===\n');

  try {
    // 1. 查询当前池状态
    console.log('1️⃣  查询当前池状态...');
    const statsBefore = await prisma.shortIdPool.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    console.log('初始状态统计:', statsBefore);
    console.log('');

    // 2. 查询当前最大shortID
    const maxShortId = await prisma.shortIdPool.findFirst({
      orderBy: { shortId: 'desc' },
      select: { shortId: true },
    });
    console.log('当前最大shortID:', maxShortId?.shortId || 0);
    console.log('');

    // 3. 查询Room、Cabinet、Panel、CableEndpoint的使用情况
    console.log('2️⃣  查询各实体的shortID使用情况...');
    const [roomCount, cabinetCount, panelCount, endpointCount] = await Promise.all([
      prisma.room.count({ where: { shortId: { not: null } } }),
      prisma.cabinet.count({ where: { shortId: { not: null } } }),
      prisma.panel.count({ where: { shortId: { not: null } } }),
      prisma.cableEndpoint.count({ where: { shortId: { not: null } } }),
    ]);
    console.log(`  - Room: ${roomCount} 个`);
    console.log(`  - Cabinet: ${cabinetCount} 个`);
    console.log(`  - Panel: ${panelCount} 个`);
    console.log(`  - CableEndpoint: ${endpointCount} 个`);
    console.log('');

    // 4. 查询ShortIdPool中BOUND状态的记录
    console.log('3️⃣  查询ShortIdPool中BOUND状态的记录...');
    const boundRecords = await prisma.shortIdPool.groupBy({
      by: ['entityType'],
      where: { status: 'BOUND' },
      _count: { _all: true },
    });
    console.log('BOUND状态统计:', boundRecords);
    console.log('');

    // 5. 查询GlobalShortIdAllocation的记录
    console.log('4️⃣  查询GlobalShortIdAllocation的记录...');
    const globalAllocations = await prisma.globalShortIdAllocation.groupBy({
      by: ['entityType'],
      _count: { _all: true },
    });
    console.log('全局分配统计:', globalAllocations);
    console.log('');

    // 6. 验证数据一致性
    console.log('5️⃣  验证数据一致性...');

    // 检查ShortIdPool中BOUND状态的数量是否与GlobalShortIdAllocation一致
    const boundCount = await prisma.shortIdPool.count({
      where: { status: 'BOUND' },
    });
    const globalCount = await prisma.globalShortIdAllocation.count();

    console.log(`  - ShortIdPool BOUND记录: ${boundCount}`);
    console.log(`  - GlobalShortIdAllocation记录: ${globalCount}`);

    if (boundCount === globalCount) {
      console.log('  ✅ 数据一致！');
    } else {
      console.log('  ⚠️  数据不一致！可能存在同步问题');
    }
    console.log('');

    // 7. 查看最近10条ShortIdPool记录
    console.log('6️⃣  最近10条ShortIdPool记录...');
    const recentRecords = await prisma.shortIdPool.findMany({
      take: 10,
      orderBy: { updatedAt: 'desc' },
      select: {
        shortId: true,
        status: true,
        entityType: true,
        entityId: true,
        boundAt: true,
        batchNo: true,
      },
    });
    console.table(recentRecords);
    console.log('');

    // 8. 检查是否有孤立的shortID（在实体表中但不在ShortIdPool中）
    console.log('7️⃣  检查孤立的shortID...');

    const rooms = await prisma.room.findMany({
      where: { shortId: { not: null } },
      select: { id: true, shortId: true },
    });

    let orphanedCount = 0;
    for (const room of rooms) {
      const poolRecord = await prisma.shortIdPool.findFirst({
        where: { shortId: room.shortId! },
      });
      if (!poolRecord) {
        console.log(`  ⚠️  Room ${room.id} 的 shortID ${room.shortId} 不在池中`);
        orphanedCount++;
      }
    }

    if (orphanedCount === 0) {
      console.log('  ✅ 没有发现孤立的shortID');
    } else {
      console.log(`  ⚠️  发现 ${orphanedCount} 个孤立的shortID`);
    }
    console.log('');

    console.log('=== 测试完成 ===');
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testShortIdPoolTracking();
