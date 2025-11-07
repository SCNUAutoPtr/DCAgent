/**
 * 同步现有线缆数据到 Neo4j
 * 运行方式：npx tsx src/scripts/syncCablesToNeo4j.ts
 */

import prisma from '../utils/prisma';
import cableGraphService from '../graph/cableGraph';

async function syncCablesToNeo4j() {
  console.log('开始同步线缆数据到 Neo4j...');

  try {
    // 获取所有线缆（包含端点信息）
    const cables = await prisma.cable.findMany({
      include: {
        endpoints: {
          include: {
            port: true,
          },
        },
      },
    });

    console.log(`找到 ${cables.length} 条线缆记录`);

    let successCount = 0;
    let failCount = 0;

    for (const cable of cables) {
      try {
        console.log(`同步线缆 ${cable.id} (shortId: ${cable.shortId})...`);

        // 同步线缆节点信息
        await cableGraphService.syncCableNode(cable.id, {
          type: cable.type,
          label: cable.label,
          color: cable.color,
          length: cable.length,
          shortId: cable.shortId,
        });

        successCount++;
        console.log(`✓ 线缆 ${cable.id} 同步成功 (端点数: ${cable.endpoints.length})`);
      } catch (error) {
        failCount++;
        console.error(`✗ 线缆 ${cable.id} 同步失败:`, error);
      }
    }

    console.log('\n同步完成！');
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${failCount}`);
  } catch (error) {
    console.error('同步过程中发生错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

syncCablesToNeo4j();
