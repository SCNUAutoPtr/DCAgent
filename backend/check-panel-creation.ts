import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPanelCreation() {
  try {
    // 查询空端口面板的详细信息
    const emptyPanels = [
      '36b8ecb2-d9b7-43e2-9f1d-cc714c1ea2b8',
      '5a229484-71e3-4f88-a722-59bc06eed5f4',
      '7d5213e2-669c-4e90-8c5d-7f63ec9342e0'
    ];

    console.log('检查空端口面板的创建情况：\n');

    for (const panelId of emptyPanels) {
      const panel = await prisma.panel.findUnique({
        where: { id: panelId },
        include: {
          device: true,
          ports: true
        }
      });

      if (panel) {
        console.log(`面板: ${panel.name}`);
        console.log(`  创建时间: ${panel.createdAt}`);
        console.log(`  更新时间: ${panel.updatedAt}`);
        console.log(`  设备ID: ${panel.deviceId}`);
        console.log(`  尺寸: ${panel.size ? JSON.stringify(panel.size) : '未设置'}`);
        console.log(`  端口模板: ${panel.portTemplate || '未设置'}`);
        console.log('');
      }
    }

    // 查看设备创建/复制的历史
    console.log('查看1号交换机的所有面板：\n');
    const device = await prisma.device.findFirst({
      where: { name: '1号交换机' },
      include: {
        panels: {
          include: {
            _count: {
              select: { ports: true }
            }
          }
        }
      }
    });

    if (device) {
      console.log(`设备: ${device.name}`);
      console.log(`面板数量: ${device.panels.length}`);
      device.panels.forEach(panel => {
        console.log(`  - ${panel.name}: ${panel._count.ports} 个端口`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPanelCreation();
