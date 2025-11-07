/**
 * 将现有数据迁移到全局 ShortID 系统
 *
 * 运行方式：npx tsx src/scripts/migrateToGlobalShortId.ts
 *
 * 注意：运行此脚本前，请先执行 prisma migrate 创建新表
 */

import prisma from '../utils/prisma';

async function migrateToGlobalShortId() {
  console.log('开始迁移到全局 ShortID 系统...\n');

  try {
    // 收集所有现有的 shortId 分配
    const allocations: Array<{
      entityType: string;
      entityId: string;
      shortId: number;
    }> = [];

    // 1. 收集 DataCenter
    const dataCenters = await prisma.dataCenter.findMany({
      select: { id: true, shortId: true, name: true },
    });
    console.log(`发现 ${dataCenters.length} 个 DataCenter 需要迁移`);
    dataCenters.forEach((dc) => {
      if (dc.shortId) {
        allocations.push({
          entityType: 'DataCenter',
          entityId: dc.id,
          shortId: dc.shortId,
        });
        console.log(`  - DataCenter "${dc.name}": shortId=${dc.shortId}`);
      }
    });

    // 2. 收集 Room
    const rooms = await prisma.room.findMany({
      select: { id: true, shortId: true, name: true },
    });
    console.log(`\n发现 ${rooms.length} 个 Room 需要迁移`);
    rooms.forEach((room) => {
      if (room.shortId) {
        allocations.push({
          entityType: 'Room',
          entityId: room.id,
          shortId: room.shortId,
        });
        console.log(`  - Room "${room.name}": shortId=${room.shortId}`);
      }
    });

    // 3. 收集 Cabinet
    const cabinets = await prisma.cabinet.findMany({
      select: { id: true, shortId: true, name: true },
    });
    console.log(`\n发现 ${cabinets.length} 个 Cabinet 需要迁移`);
    cabinets.forEach((cabinet) => {
      if (cabinet.shortId) {
        allocations.push({
          entityType: 'Cabinet',
          entityId: cabinet.id,
          shortId: cabinet.shortId,
        });
        console.log(`  - Cabinet "${cabinet.name}": shortId=${cabinet.shortId}`);
      }
    });

    // 4. 收集 Device
    const devices = await prisma.device.findMany({
      select: { id: true, shortId: true, name: true },
    });
    console.log(`\n发现 ${devices.length} 个 Device 需要迁移`);
    devices.forEach((device) => {
      if (device.shortId) {
        allocations.push({
          entityType: 'Device',
          entityId: device.id,
          shortId: device.shortId,
        });
        console.log(`  - Device "${device.name}": shortId=${device.shortId}`);
      }
    });

    // 5. 收集 Port
    const ports = await prisma.port.findMany({
      select: { id: true, shortId: true, number: true },
    });
    console.log(`\n发现 ${ports.length} 个 Port 需要迁移`);
    ports.forEach((port) => {
      if (port.shortId) {
        allocations.push({
          entityType: 'Port',
          entityId: port.id,
          shortId: port.shortId,
        });
        console.log(`  - Port #${port.number}: shortId=${port.shortId}`);
      }
    });

    // 6. 收集 Cable
    const cables = await prisma.cable.findMany({
      select: { id: true, shortId: true, label: true },
    });
    console.log(`\n发现 ${cables.length} 个 Cable 需要迁移`);
    cables.forEach((cable) => {
      if (cable.shortId) {
        allocations.push({
          entityType: 'Cable',
          entityId: cable.id,
          shortId: cable.shortId,
        });
        console.log(`  - Cable "${cable.label || 'Unlabeled'}": shortId=${cable.shortId}`);
      }
    });

    // 7. 收集 Panel（如果有 shortId）
    const panels = await prisma.panel.findMany({
      select: { id: true, shortId: true, name: true },
    });
    console.log(`\n发现 ${panels.length} 个 Panel 需要迁移`);
    panels.forEach((panel) => {
      if (panel.shortId) {
        allocations.push({
          entityType: 'Panel',
          entityId: panel.id,
          shortId: panel.shortId,
        });
        console.log(`  - Panel "${panel.name}": shortId=${panel.shortId}`);
      }
    });

    // 检查是否有 shortId 冲突
    console.log('\n\n=== 检查 ShortID 冲突 ===');
    const shortIdMap = new Map<number, Array<{ entityType: string; entityId: string }>>();
    allocations.forEach((alloc) => {
      if (!shortIdMap.has(alloc.shortId)) {
        shortIdMap.set(alloc.shortId, []);
      }
      shortIdMap.get(alloc.shortId)!.push({
        entityType: alloc.entityType,
        entityId: alloc.entityId,
      });
    });

    const conflicts: Array<{ shortId: number; entities: Array<{ entityType: string; entityId: string }> }> = [];
    shortIdMap.forEach((entities, shortId) => {
      if (entities.length > 1) {
        conflicts.push({ shortId, entities });
      }
    });

    if (conflicts.length > 0) {
      console.log(`\n警告：发现 ${conflicts.length} 个 ShortID 冲突！`);
      conflicts.forEach(({ shortId, entities }) => {
        console.log(`\nShortID ${shortId} 被以下实体使用：`);
        entities.forEach(({ entityType, entityId }) => {
          console.log(`  - ${entityType}: ${entityId}`);
        });
      });
      console.log('\n需要重新分配冲突的 shortId...');

      // 重新分配冲突的 shortId
      let maxShortId = Math.max(...allocations.map(a => a.shortId));

      for (const conflict of conflicts) {
        // 保留第一个实体的 shortId，重新分配其他实体
        const [first, ...rest] = conflict.entities;
        console.log(`\n保留 ${first.entityType} 的 shortId ${conflict.shortId}`);

        for (const entity of rest) {
          maxShortId++;
          console.log(`  重新分配 ${entity.entityType} ${entity.entityId}: ${conflict.shortId} -> ${maxShortId}`);

          // 更新分配记录
          const allocIndex = allocations.findIndex(
            a => a.entityType === entity.entityType && a.entityId === entity.entityId
          );
          if (allocIndex !== -1) {
            allocations[allocIndex].shortId = maxShortId;
          }

          // 更新数据库中的 shortId
          switch (entity.entityType) {
            case 'DataCenter':
              await prisma.dataCenter.update({
                where: { id: entity.entityId },
                data: { shortId: maxShortId },
              });
              break;
            case 'Room':
              await prisma.room.update({
                where: { id: entity.entityId },
                data: { shortId: maxShortId },
              });
              break;
            case 'Cabinet':
              await prisma.cabinet.update({
                where: { id: entity.entityId },
                data: { shortId: maxShortId },
              });
              break;
            case 'Device':
              await prisma.device.update({
                where: { id: entity.entityId },
                data: { shortId: maxShortId },
              });
              break;
            case 'Port':
              await prisma.port.update({
                where: { id: entity.entityId },
                data: { shortId: maxShortId },
              });
              break;
            case 'Cable':
              await prisma.cable.update({
                where: { id: entity.entityId },
                data: { shortId: maxShortId },
              });
              break;
            case 'Panel':
              await prisma.panel.update({
                where: { id: entity.entityId },
                data: { shortId: maxShortId },
              });
              break;
          }
        }
      }
    } else {
      console.log('没有发现 ShortID 冲突');
    }

    // 写入全局分配表
    console.log('\n\n=== 写入全局分配表 ===');
    let successCount = 0;
    let failCount = 0;

    for (const alloc of allocations) {
      try {
        await prisma.globalShortIdAllocation.create({
          data: {
            shortId: alloc.shortId,
            entityType: alloc.entityType,
            entityId: alloc.entityId,
          },
        });
        successCount++;
      } catch (error) {
        console.error(`失败: ${alloc.entityType} ${alloc.entityId} shortId=${alloc.shortId}`, error);
        failCount++;
      }
    }

    console.log(`\n写入完成: 成功 ${successCount}, 失败 ${failCount}`);

    // 初始化序列值
    const maxShortId = Math.max(...allocations.map(a => a.shortId), 0);
    const nextValue = maxShortId + 1;

    console.log(`\n初始化全局序列，起始值: ${nextValue}`);
    await prisma.globalShortIdSequence.create({
      data: {
        currentValue: nextValue,
      },
    });

    console.log('\n✅ 迁移完成！');
    console.log(`总共迁移了 ${allocations.length} 个实体的 shortId`);
    console.log(`下一个可用的 shortId: ${nextValue}`);

  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

migrateToGlobalShortId();
