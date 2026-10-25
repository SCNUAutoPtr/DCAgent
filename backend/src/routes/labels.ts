import { emptyBody } from '../contracts/common';
import * as c from '../contracts/labels';
import { rpcRouter } from '../http/rpc';
import { prisma } from '../utils/prisma';
import { labelService, toCsv } from '../services/labelService';

export function labelsRouter() {
  const r = rpcRouter();
  r.read('list', c.labelListSchema, (db, b) => labelService.list(db, b));
  r.read('stats', emptyBody, (db) => labelService.stats(db));
  r.read('resolve', c.labelResolveSchema, (db, b) => labelService.resolve(db, b.shortId));
  r.read('missing', c.labelMissingSchema, (db, b) => labelService.missing(db, b));
  r.write('generate', c.labelGenerateSchema, (tx, b) => labelService.generate(tx, b));
  r.write('void', c.labelVoidSchema, (tx, b) => labelService.void(tx, b));
  r.write('rebind', c.labelRebindSchema, (tx, b) => labelService.rebind(tx, b));
  r.read('print-tasks/list', c.printTaskListSchema, (db, b) => labelService.listPrintTasks(db, b));
  r.write('print-tasks/create', c.printTaskCreateSchema, (tx, b) => labelService.createPrintTask(tx, b));
  r.write('print-tasks/complete', c.printTaskCompleteSchema, (tx, b) => labelService.completePrintTask(tx, b));
  r.raw('print-tasks/export', c.printTaskIdSchema, async (b, res) => {
    const { task, rows } = await labelService.printTaskRows(prisma, b.id);
    const csv = toCsv(
      rows.map((x) => ({ ...x })),
      ['shortId', 'display', 'state', 'bound'],
    );
    const file = `labels_${task.id.slice(0, 8)}_${task.createdAt.slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    res.send('﻿' + csv);
  });
  return r.router;
}
