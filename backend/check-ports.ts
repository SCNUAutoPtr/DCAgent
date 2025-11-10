import prisma from './src/utils/prisma';

async function main() {
  const ports = await prisma.port.findMany({
    where: {
      id: {
        in: ['8a12b15a-7851-4e1d-b842-8e0d7a719bec', 'aac6c891-70e0-46e3-b8a9-0e6e8cd21f9d']
      }
    },
    select: { number: true, status: true, physicalStatus: true }
  });
  console.log(JSON.stringify(ports, null, 2));
  await prisma.$disconnect();
}

main();
