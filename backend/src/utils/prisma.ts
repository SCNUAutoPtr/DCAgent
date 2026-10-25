import { PrismaClient, type Prisma } from '@prisma/client';

/** The only PrismaClient of the server process. */
export const prisma = new PrismaClient({ log: ['error'] });

/** Services accept a transaction client; the shared client fits the same type for reads. */
export type Db = Prisma.TransactionClient;

let hooked = false;
export function disconnectOnSignal() {
  if (hooked) return;
  hooked = true;
  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.once(sig, () => {
      prisma
        .$disconnect()
        .catch(() => undefined)
        .finally(() => process.exit(0));
    });
  }
}
