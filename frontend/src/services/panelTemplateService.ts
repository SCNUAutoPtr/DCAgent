import type { IdBody, OkResult } from '@contracts/common';
import type { PanelDetailDto } from '@contracts/panels';
import type {
  ApplyDiff,
  BatchPreview,
  BatchResult,
  ImportResult,
  PanelTemplateDto,
  TemplateDoc,
  TemplatePortDraft,
  applyPreviewSchema,
  applySchema,
  batchApplySchema,
  batchPreviewSchema,
  createPanelFromTemplateSchema,
  createPanelsFromTemplatesSchema,
  exportSchema,
  generatePreviewSchema,
  importSchema,
  templateCreateSchema,
  templateListSchema,
  templateUpdateSchema,
} from '@contracts/panelTemplates';
import { rpc, type In, type RpcOptions } from './api';

export const panelTemplateService = {
  list: (body: In<typeof templateListSchema> = {}) => rpc<typeof body, PanelTemplateDto[]>('panel-templates/list', body),
  get: (body: IdBody) => rpc<IdBody, PanelTemplateDto>('panel-templates/get', body),
  create: (body: In<typeof templateCreateSchema>) => rpc<typeof body, PanelTemplateDto>('panel-templates/create', body),
  update: (body: In<typeof templateUpdateSchema>) => rpc<typeof body, PanelTemplateDto>('panel-templates/update', body),
  delete: (body: IdBody) => rpc<IdBody, OkResult>('panel-templates/delete', body),
  generatePreview: (body: In<typeof generatePreviewSchema>) => rpc<typeof body, TemplatePortDraft[]>('panel-templates/generate-preview', body),
  applyPreview: (body: In<typeof applyPreviewSchema>) => rpc<typeof body, ApplyDiff>('panel-templates/apply-preview', body),
  apply: (body: In<typeof applySchema>, opts?: RpcOptions) => rpc<typeof body, ApplyDiff>('panel-templates/apply', body, opts),
  batchPreview: (body: In<typeof batchPreviewSchema>) => rpc<typeof body, BatchPreview>('panel-templates/batch-preview', body),
  batchApply: (body: In<typeof batchApplySchema>, opts?: RpcOptions) => rpc<typeof body, BatchResult>('panel-templates/batch-apply', body, opts),
  createPanel: (body: In<typeof createPanelFromTemplateSchema>) => rpc<typeof body, PanelDetailDto>('panel-templates/create-panel', body),
  createPanels: (body: In<typeof createPanelsFromTemplatesSchema>) => rpc<typeof body, PanelDetailDto[]>('panel-templates/create-panels', body),
  unbind: (body: { panelId: string }) => rpc<typeof body, PanelDetailDto>('panel-templates/unbind', body),
  export: (body: In<typeof exportSchema> = {}) => rpc<typeof body, TemplateDoc>('panel-templates/export', body),
  import: (body: In<typeof importSchema>) => rpc<typeof body, ImportResult>('panel-templates/import', body),
  importPresets: () => rpc<Record<string, never>, ImportResult>('panel-templates/import-presets', {}),
};
