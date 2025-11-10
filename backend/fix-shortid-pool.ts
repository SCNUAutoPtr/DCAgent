/**
 * 修复现有数据库中的shortID池数据
 * 将已有实体的shortID同步到ShortIdPool表中
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixShortIdPool() {
  console.log('=== 开始修复ShortID池数据 ===\n');

  try {
    // 1. 收集所有实体中的shortID
    console.log('1️⃣  收集所有实体中的shortID...');

    const [rooms, cabinets, panels, cableEndpoints] = await Promise.all([
      prisma.room.findMany({
        where: { shortId: { not: null } },
        select: { id: true, shortId: true, createdAt: true },
      }),
      prisma.cabinet.findMany({
        where: { shortId: { not: null } },
        select: { id: true, shortId: true, createdAt: true },
      }),
      prisma.panel.findMany({
        where: { shortId: { not: null } },
        select: { id: true, shortId: true, createdAt: true },
      }),
      prisma.cableEndpoint.findMany({
        where: { shortId: { not: null } },
        select: { id: true, shortId: true, createdAt: true },
      }),
    ]);

    console.log(`  - Room: ${rooms.length} 个`);
    console.log(`  - Cabinet: ${cabinets.length} 个`);
    console.log(`  - Panel: ${panels.length} 个`);
    console.log(`  - CableEndpoint: ${cableEndpoints.length} 个`);
    console.log('');

    // 2. 创建ShortIdPool记录
    console.log('2️⃣  创建ShortIdPool记录...');

    let createdCount = 0;
    let skippedCount = 0;

    // 处理Room
    for (const room of rooms) {
      if (!room.shortId) continue;

      const existing = await prisma.shortIdPool.findFirst({
        where: { shortId: room.shortId },
      });

      if (!existing) {
        await prisma.shortIdPool.create({
          data: {
            shortId: room.shortId,
            status: 'BOUND',
            entityType: 'ROOM',
            entityId: room.id,
            boundAt: room.createdAt,
            batchNo: 'migration_existing',
            notes: '从现有数据迁移',
          },
        });
        createdCount++;
      } else {
        skippedCount++;
      }
    }

    // 处理Cabinet
    for (const cabinet of cabinets) {
      if (!cabinet.shortId) continue;

      const existing = await prisma.shortIdPool.findFirst({
        where: { shortId: cabinet.shortId },
      });

      if (!existing) {
        await prisma.shortIdPool.create({
          data: {
            shortId: cabinet.shortId,
            status: 'BOUND',
            entityType: 'CABINET',
            entityId: cabinet.id,
            boundAt: cabinet.createdAt,
            batchNo: 'migration_existing',
            notes: '从现有数据迁移',
          },
        });
        createdCount++;
      } else {
        skippedCount++;
      }
    }

    // 处理Panel
    for (const panel of panels) {
      if (!panel.shortId) continue;

      const existing = await prisma.shortIdPool.findFirst({
        where: { shortId: panel.shortId },
      });

      if (!existing) {
        await prisma.shortIdPool.create({
          data: {
            shortId: panel.shortId,
            status: 'BOUND',
            entityType: 'PANEL',
            entityId: panel.id,
            boundAt: panel.createdAt,
            batchNo: 'migration_existing',
            notes: '从现有数据迁移',
          },
        });
        createdCount++;
      } else {
        skippedCount++;
      }
    }

    // 处理CableEndpoint
    for (const endpoint of cableEndpoints) {
      if (!endpoint.shortId) continue;

      const existing = await prisma.shortIdPool.findFirst({
        where: { shortId: endpoint.shortId },
      });

      if (!existing) {
        await prisma.shortIdPool.create({
          data: {
            shortId: endpoint.shortId,
            status: 'BOUND',
            entityType: 'CABLE_ENDPOINT',
            entityId: endpoint.id,
            boundAt: endpoint.createdAt,
            batchNo: 'migration_existing',
            notes: '从现有数据迁移',
          },
        });
        createdCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`  ✅ 创建了 ${createdCount} 条ShortIdPool记录`);
    console.log(`  ⏭️  跳过了 ${skippedCount} 条已存在的记录`);
    console.log('');

    // 3. 验证GlobalShortIdAllocation的一致性
    console.log('3️⃣  验证GlobalShortIdAllocation的一致性...');

    const globalAllocations = await prisma.globalShortIdAllocation.findMany();
    let syncedCount = 0;
    let missingCount = 0;

    for (const allocation of globalAllocations) {
      const poolRecord = await prisma.shortIdPool.findFirst({
        where: { shortId: allocation.shortId },
      });

      if (!poolRecord) {
        console.log(`  ⚠️  GlobalShortIdAllocation中的 shortID ${allocation.shortId} (${allocation.entityType}) 不在池中`);
        missingCount++;
      } else {
        syncedCount++;
      }
    }

    console.log(`  ✅ 同步的记录: ${syncedCount}`);
    console.log(`  ⚠️  缺失的记录: ${missingCount}`);
    console.log('');

    // 4. 最终统计
    console.log('4️⃣  修复后的统计信息...');

    const stats = await prisma.shortIdPool.groupBy({
      by: ['status', 'entityType'],
      _count: { _all: true },
    });

    console.table(stats);
    console.log('');

    const totalBound = await prisma.shortIdPool.count({
      where: { status: 'BOUND' },
    });
    const totalGlobal = await prisma.globalShortIdAllocation.count();

    console.log(`总计:`);
    console.log(`  - ShortIdPool BOUND记录: ${totalBound}`);
    console.log(`  - GlobalShortIdAllocation记录: ${totalGlobal}`);

    if (totalBound === totalGlobal) {
      console.log('  ✅ 数据已同步！');
    } else {
      console.log('  ⚠️  数据仍不一致，可能需要进一步检查');
    }

    console.log('\n=== 修复完成 ===');
  } catch (error) {
    console.error('修复失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixShortIdPool();
