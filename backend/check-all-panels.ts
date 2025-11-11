import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllPanels() {
  try {
    const panels = await prisma.panel.findMany({
      include: {
        ports: true,
        device: {
          select: {
            name: true,
            type: true,
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log('='.repeat(80));
    console.log(`总共找到 ${panels.length} 个面板\n`);

    let emptyPortPanels = 0;
    let normalPanels = 0;

    panels.forEach((panel, index) => {
      const portCount = panel.ports.length;
      const isEmpty = portCount === 0;

      if (isEmpty) emptyPortPanels++;
      else normalPanels++;

      const statusIcon = isEmpty ? '❌' : '✅';

      console.log(`${statusIcon} 面板 #${index + 1}: ${panel.name}`);
      console.log(`   ID: ${panel.id}`);
      console.log(`   ShortID: ${panel.shortId || '未设置'}`);
      console.log(`   设备: ${panel.device?.name || '未关联'} (${panel.device?.type || '-'})`);
      console.log(`   类型: ${panel.type}`);
      console.log(`   端口数: ${portCount}`);

      if (isEmpty) {
        console.log(`   ⚠️  警告: 该面板没有端口！`);
      }

      console.log('');
    });

    console.log('='.repeat(80));
    console.log(`统计结果：`);
    console.log(`  ✅ 正常面板（有端口）: ${normalPanels} 个`);
    console.log(`  ❌ 空端口面板: ${emptyPortPanels} 个`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllPanels();
