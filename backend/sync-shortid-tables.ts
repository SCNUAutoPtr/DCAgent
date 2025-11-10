/**
 * 完全同步ShortIdPool和GlobalShortIdAllocation两个表
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncShortIdTables() {
  console.log('=== 开始同步ShortIdPool和GlobalShortIdAllocation ===\n');

  try {
    // 1. 获取ShortIdPool中所有BOUND的记录
    console.log('1️⃣  获取ShortIdPool中所有BOUND的记录...');
    const poolRecords = await prisma.shortIdPool.findMany({
      where: { status: 'BOUND' },
      select: {
        shortId: true,
        entityType: true,
        entityId: true,
      },
    });
    console.log(`  找到 ${poolRecords.length} 条BOUND记录`);
    console.log('');

    // 2. 同步到GlobalShortIdAllocation
    console.log('2️⃣  同步到GlobalShortIdAllocation...');
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const record of poolRecords) {
      if (!record.entityType || !record.entityId) {
        console.log(`  ⚠️  跳过shortID ${record.shortId}（缺少entityType或entityId）`);
        skippedCount++;
        continue;
      }

      const existing = await prisma.globalShortIdAllocation.findUnique({
        where: { shortId: record.shortId },
      });

      if (existing) {
        // 检查是否需要更新
        if (existing.entityType !== record.entityType || existing.entityId !== record.entityId) {
          await prisma.globalShortIdAllocation.update({
            where: { shortId: record.shortId },
            data: {
              entityType: record.entityType,
              entityId: record.entityId,
            },
          });
          console.log(`  ✏️  更新 shortID ${record.shortId}: ${record.entityType}`);
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        // 创建新记录
        await prisma.globalShortIdAllocation.create({
          data: {
            shortId: record.shortId,
            entityType: record.entityType,
            entityId: record.entityId,
          },
        });
        console.log(`  ✅ 创建 shortID ${record.shortId}: ${record.entityType}`);
        createdCount++;
      }
    }

    console.log('');
    console.log(`总结:`);
    console.log(`  ✅ 创建: ${createdCount} 条`);
    console.log(`  ✏️  更新: ${updatedCount} 条`);
    console.log(`  ⏭️  跳过: ${skippedCount} 条`);
    console.log('');

    // 3. 清理GlobalShortIdAllocation中多余的记录
    console.log('3️⃣  清理GlobalShortIdAllocation中多余的记录...');
    const globalRecords = await prisma.globalShortIdAllocation.findMany();
    let deletedCount = 0;

    for (const globalRecord of globalRecords) {
      const poolRecord = await prisma.shortIdPool.findFirst({
        where: {
          shortId: globalRecord.shortId,
          status: 'BOUND',
        },
      });

      if (!poolRecord) {
        // 检查实体是否还存在
        let entityExists = false;

        switch (globalRecord.entityType) {
          case 'Room':
            entityExists = !!(await prisma.room.findFirst({
              where: {
                id: globalRecord.entityId,
                shortId: globalRecord.shortId,
              },
            }));
            break;
          case 'Cabinet':
            entityExists = !!(await prisma.cabinet.findFirst({
              where: {
                id: globalRecord.entityId,
                shortId: globalRecord.shortId,
              },
            }));
            break;
          case 'Panel':
            entityExists = !!(await prisma.panel.findFirst({
              where: {
                id: globalRecord.entityId,
                shortId: globalRecord.shortId,
              },
            }));
            break;
          case 'CableEndpoint':
            entityExists = !!(await prisma.cableEndpoint.findFirst({
              where: {
                id: globalRecord.entityId,
                shortId: globalRecord.shortId,
              },
            }));
            break;
        }

        if (!entityExists) {
          await prisma.globalShortIdAllocation.delete({
            where: { shortId: globalRecord.shortId },
          });
          console.log(`  🗑️  删除 shortID ${globalRecord.shortId}（实体不存在）`);
          deletedCount++;
        }
      }
    }

    console.log('');
    console.log(`  🗑️  删除: ${deletedCount} 条多余记录`);
    console.log('');

    // 4. 更新GlobalShortIdSequence
    console.log('4️⃣  更新GlobalShortIdSequence...');
    const maxShortId = await prisma.shortIdPool.findFirst({
      orderBy: { shortId: 'desc' },
      select: { shortId: true },
    });

    if (maxShortId) {
      const sequence = await prisma.globalShortIdSequence.findFirst();
      const nextValue = maxShortId.shortId + 1;

      if (sequence) {
        await prisma.globalShortIdSequence.update({
          where: { id: sequence.id },
          data: { currentValue: nextValue },
        });
        console.log(`  ✅ 更新序列值为: ${nextValue}`);
      } else {
        await prisma.globalShortIdSequence.create({
          data: { currentValue: nextValue },
        });
        console.log(`  ✅ 创建序列值: ${nextValue}`);
      }
    }
    console.log('');

    // 5. 最终验证
    console.log('5️⃣  最终验证...');
    const finalPoolCount = await prisma.shortIdPool.count({
      where: { status: 'BOUND' },
    });
    const finalGlobalCount = await prisma.globalShortIdAllocation.count();

    console.log(`  - ShortIdPool BOUND记录: ${finalPoolCount}`);
    console.log(`  - GlobalShortIdAllocation记录: ${finalGlobalCount}`);

    if (finalPoolCount === finalGlobalCount) {
      console.log('  ✅ 数据完全同步！');
    } else {
      console.log('  ⚠️  数据仍不一致，可能需要进一步检查');
    }

    console.log('\n=== 同步完成 ===');
  } catch (error) {
    console.error('同步失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

syncShortIdTables();
