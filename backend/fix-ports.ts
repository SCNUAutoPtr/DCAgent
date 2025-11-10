import prisma from './src/utils/prisma';

async function main() {
  await prisma.port.updateMany({
    where: {
      id: {
        in: ['8a12b15a-7851-4e1d-b842-8e0d7a719bec', 'aac6c891-70e0-46e3-b8a9-0e6e8cd21f9d']
      }
    },
    data: {
      status: 'AVAILABLE',
      physicalStatus: 'EMPTY'
    }
  });

  console.log('端口状态已修复');
  await prisma.$disconnect();
}

main();
