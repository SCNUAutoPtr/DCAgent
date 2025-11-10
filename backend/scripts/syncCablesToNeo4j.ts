import prisma from '../src/utils/prisma';
import cableGraphService from '../src/graph/cableGraph';

async function syncAllCablesToNeo4j() {
  console.log('开始同步所有线缆数据到Neo4j...\n');

  // 获取所有状态为IN_USE的线缆
  const cables = await prisma.cable.findMany({
    where: {
      inventoryStatus: 'IN_USE'
    },
    include: {
      endpoints: {
        include: {
          port: {
            include: {
              panel: true
            }
          }
        }
      }
    }
  });

  console.log(`找到 ${cables.length} 条使用中的线缆\n`);

  for (const cable of cables) {
    const endpointA = cable.endpoints.find(e => e.endType === 'A');
    const endpointB = cable.endpoints.find(e => e.endType === 'B');

    if (endpointA?.portId && endpointB?.portId && endpointA.port && endpointB.port) {
      console.log(`同步线缆 ${cable.id.substring(0, 8)}...`);
      console.log(`  ${endpointA.port.panel?.name || '?'} (端口 ${endpointA.port.number}) <-> ${endpointB.port.panel?.name || '?'} (端口 ${endpointB.port.number})`);

      try {
        // 同步面板节点
        if (endpointA.port.panel) {
          await cableGraphService.syncPanelNode(endpointA.port.panel.id, endpointA.port.panel);
        }
        if (endpointB.port.panel) {
          await cableGraphService.syncPanelNode(endpointB.port.panel.id, endpointB.port.panel);
        }

        // 同步端口节点
        await cableGraphService.syncPortNode(endpointA.portId, {
          ...endpointA.port,
          panelId: endpointA.port.panelId
        });
        await cableGraphService.syncPortNode(endpointB.portId, {
          ...endpointB.port,
          panelId: endpointB.port.panelId
        });

        // 同步线缆连接
        await cableGraphService.createConnection({
          cableId: cable.id,
          portAId: endpointA.portId,
          portBId: endpointB.portId,
          cableData: {
            label: cable.label || undefined,
            type: cable.type,
            color: cable.color || undefined,
            length: cable.length || undefined
          }
        });

        console.log('  ✓ 同步完成\n');
      } catch (error: any) {
        console.error('  ✗ 同步失败:', error.message);
      }
    }
  }

  console.log('所有线缆同步完成！');
  await prisma.$disconnect();
}

syncAllCablesToNeo4j().catch(console.error);
