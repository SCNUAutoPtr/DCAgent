import type { Paged } from '@contracts/common';
import type {
  LabelDto,
  LabelGenerateResult,
  LabelResolveResult,
  LabelStats,
  LabelVoidResult,
  MissingLabelItem,
  PrintTaskDto,
  labelGenerateSchema,
  labelListSchema,
  labelMissingSchema,
  labelRebindSchema,
  labelVoidSchema,
  printTaskCompleteSchema,
  printTaskCreateSchema,
  printTaskListSchema,
} from '@contracts/labels';
import { rpc, rpcBlob, type In, type RpcOptions } from './api';

export const labelService = {
  list: (body: In<typeof labelListSchema> = {}) => rpc<typeof body, Paged<LabelDto>>('labels/list', body),
  stats: () => rpc<Record<string, never>, LabelStats>('labels/stats', {}),
  generate: (body: In<typeof labelGenerateSchema>) => rpc<typeof body, LabelGenerateResult>('labels/generate', body),
  resolve: (body: { shortId: number }, opts?: RpcOptions) => rpc<typeof body, LabelResolveResult>('labels/resolve', body, opts),
  void: (body: In<typeof labelVoidSchema>) => rpc<typeof body, LabelVoidResult>('labels/void', body),
  rebind: (body: In<typeof labelRebindSchema>) => rpc<typeof body, LabelDto>('labels/rebind', body),
  missing: (body: In<typeof labelMissingSchema> = {}) => rpc<typeof body, MissingLabelItem[]>('labels/missing', body),
  printTasks: {
    list: (body: In<typeof printTaskListSchema> = {}) => rpc<typeof body, Paged<PrintTaskDto>>('labels/print-tasks/list', body),
    create: (body: In<typeof printTaskCreateSchema>) =>
      rpc<typeof body, PrintTaskDto & { shortIds: number[] }>('labels/print-tasks/create', body),
    complete: (body: In<typeof printTaskCompleteSchema>) => rpc<typeof body, PrintTaskDto>('labels/print-tasks/complete', body),
    exportCsv: (body: { id: string }) => rpcBlob('labels/print-tasks/export', body),
  },
};
