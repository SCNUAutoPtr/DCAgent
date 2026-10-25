import { Router, type Request, type Response } from 'express';
import type { z } from 'zod';
import { prisma, type Db } from '../utils/prisma';

type Handler<S extends z.ZodTypeAny, R> = (db: Db, body: z.infer<S>) => Promise<R> | R;

const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

/**
 * Runs fn in one transaction. Deferred constraint triggers (LABEL_REQUIRED) are forced to run
 * before Prisma commits: Prisma does not surface errors raised at COMMIT of an interactive
 * transaction, so they must fire while the callback can still throw.
 */
export function inTx<R>(fn: (tx: Db) => Promise<R>): Promise<R> {
  return prisma.$transaction(async (tx) => {
    const out = await fn(tx);
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
    return out;
  }, TX_OPTIONS);
}

/**
 * RPC router: every action is `POST /<action>` with a JSON body validated by zod.
 * - read:  runs against the shared client
 * - write: runs inside one interactive transaction (all or nothing)
 * - raw:   handler writes the response itself (file downloads)
 */
export function rpcRouter() {
  const router = Router();

  const bind = <S extends z.ZodTypeAny>(action: string, schema: S, run: (body: z.infer<S>, res: Response) => Promise<unknown>) => {
    router.post(`/${action}`, (req: Request, res: Response, next) => {
      Promise.resolve()
        .then(() => schema.parse(req.body ?? {}))
        .then((body) => run(body, res))
        .then((out) => {
          if (!res.headersSent) res.json(out ?? { ok: true });
        })
        .catch(next);
    });
  };

  return {
    router,
    read<S extends z.ZodTypeAny, R>(action: string, schema: S, fn: Handler<S, R>) {
      bind(action, schema, async (body) => fn(prisma, body));
    },
    write<S extends z.ZodTypeAny, R>(action: string, schema: S, fn: Handler<S, R>) {
      bind(action, schema, async (body) => inTx(async (tx) => fn(tx, body)));
    },
    raw<S extends z.ZodTypeAny>(action: string, schema: S, fn: (body: z.infer<S>, res: Response) => Promise<void>) {
      bind(action, schema, async (body, res) => {
        await fn(body, res);
        return undefined;
      });
    },
  };
}
