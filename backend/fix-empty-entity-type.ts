/**
 * 修复ShortIdPool中entityType为空的记录
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixEmptyEntityType() {
  console.log('=== 开始修复entityType为空的记录 ===\n');

  try {
    // 1. 查找所有entityType为空的记录
    console.log('1️⃣  查找entityType为空的记录...');
    const emptyRecords = await prisma.shortIdPool.findMany({
      where: {
        OR: [
          { entityType: null },
          { entityId: null },
          { entityId: '' },
        ],
      },
      select: {
        id: true,
        shortId: true,
        status: true,
        entityType: true,
        entityId: true,
      },
    });

    console.log(`  找到 ${emptyRecords.length} 条记录需要修复`);
    console.log('');

    if (emptyRecords.length === 0) {
      console.log('  ✅ 没有需要修复的记录');
      return;
    }

    // 2. 逐个修复
    console.log('2️⃣  开始修复记录...');
    let fixedCount = 0;
    let skippedCount = 0;

    for (const record of emptyRecords) {
      console.log(`\n  处理 shortID ${record.shortId}...`);

      // 在实体表中查找这个shortID
      const [room, cabinet, panel, cableEndpoint] = await Promise.all([
        prisma.room.findFirst({
          where: { shortId: record.shortId },
          select: { id: true, name: true },
        }),
        prisma.cabinet.findFirst({
          where: { shortId: record.shortId },
          select: { id: true, name: true },
        }),
        prisma.panel.findFirst({
          where: { shortId: record.shortId },
          select: { id: true, name: true },
        }),
        prisma.cableEndpoint.findFirst({
          where: { shortId: record.shortId },
          select: { id: true, cableId: true, endType: true },
        }),
      ]);

      let entityType: string | null = null;
      let entityId: string | null = null;
      let entityName = '';

      if (room) {
        entityType = 'ROOM';
        entityId = room.id;
        entityName = room.name;
      } else if (cabinet) {
        entityType = 'CABINET';
        entityId = cabinet.id;
        entityName = cabinet.name;
      } else if (panel) {
        entityType = 'PANEL';
        entityId = panel.id;
        entityName = panel.name;
      } else if (cableEndpoint) {
        entityType = 'CABLE_ENDPOINT';
        entityId = cableEndpoint.id;
        entityName = `Cable ${cableEndpoint.cableId} - ${cableEndpoint.endType}`;
      }

      if (entityType && entityId) {
        // 更新ShortIdPool
        await prisma.shortIdPool.update({
          where: { id: record.id },
          data: {
            entityType: entityType as any,
            entityId: entityId,
          },
        });

        // 同步到GlobalShortIdAllocation
        const globalRecord = await prisma.globalShortIdAllocation.findUnique({
          where: { shortId: record.shortId },
        });

        if (globalRecord) {
          await prisma.globalShortIdAllocation.update({
            where: { shortId: record.shortId },
            data: {
              entityType: entityType,
              entityId: entityId,
            },
          });
        } else {
          await prisma.globalShortIdAllocation.create({
            data: {
              shortId: record.shortId,
              entityType: entityType,
              entityId: entityId,
            },
          });
        }

        console.log(`    ✅ 已修复: ${entityType} - ${entityName}`);
        fixedCount++;
      } else {
        console.log(`    ⏭️  跳过: 找不到对应的实体`);
        skippedCount++;
      }
    }

    console.log('\n');
    console.log('3️⃣  修复完成统计...');
    console.log(`  ✅ 成功修复: ${fixedCount} 条`);
    console.log(`  ⏭️  跳过: ${skippedCount} 条`);
    console.log('');

    // 4. 验证修复结果
    console.log('4️⃣  验证修复结果...');
    const remainingEmpty = await prisma.shortIdPool.count({
      where: {
        OR: [
          { entityType: null },
          { entityId: null },
          { entityId: '' },
        ],
        status: 'BOUND', // 只检查BOUND状态的
      },
    });

    if (remainingEmpty === 0) {
      console.log('  ✅ 所有BOUND状态的记录都已有正确的entityType和entityId');
    } else {
      console.log(`  ⚠️  仍有 ${remainingEmpty} 条BOUND状态的记录缺少信息`);
    }

    console.log('\n=== 修复完成 ===');
  } catch (error) {
    console.error('修复失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixEmptyEntityType();
