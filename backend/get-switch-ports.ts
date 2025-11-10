import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getSwitchPorts() {
  try {
    const switches = await prisma.device.findMany({
      where: { type: 'SWITCH' },
      include: {
        panels: {
          include: {
            ports: {
              where: { status: 'AVAILABLE' },
              take: 3, // 每个交换机取3个可用端口
            },
          },
        },
      },
    });

    console.log('交换机端口信息：\n');
    switches.forEach((sw, idx) => {
      console.log(`\n=== 交换机 ${idx + 1}: ${sw.name} (${sw.id}) ===`);
      sw.panels.forEach(panel => {
        console.log(`\n面板: ${panel.name} (${panel.id})`);
        panel.ports.forEach(port => {
          console.log(`  端口: ${port.name} - ID: ${port.id} - 状态: ${port.status}`);
        });
      });
    });

    return switches;
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getSwitchPorts();
