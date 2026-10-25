import { idBody } from '../contracts/common';
import * as c from '../contracts/panelTemplates';
import { rpcRouter } from '../http/rpc';
import { panelTemplateService as s } from '../services/panelTemplateService';

export function panelTemplatesRouter() {
  const r = rpcRouter();
  r.read('list', c.templateListSchema, (db, b) => s.list(db, b));
  r.read('get', idBody, (db, b) => s.get(db, b.id));
  r.read('generate-preview', c.generatePreviewSchema, (_db, b) => s.generatePreview(b.generator, b.heightMm));
  r.read('apply-preview', c.applyPreviewSchema, (db, b) => s.applyPreview(db, b.templateId, b.panelId));
  r.read('batch-preview', c.batchPreviewSchema, (db, b) => s.batchPreview(db, b.templateId));
  r.read('export', c.exportSchema, (db, b) => s.export(db, b.ids));
  r.write('create', c.templateCreateSchema, (tx, b) => s.create(tx, b));
  r.write('update', c.templateUpdateSchema, (tx, b) => s.update(tx, b));
  r.write('delete', idBody, (tx, b) => s.delete(tx, b.id));
  r.write('apply', c.applySchema, (tx, b) => s.apply(tx, b));
  r.write('batch-apply', c.batchApplySchema, (tx, b) => s.batchApply(tx, b));
  r.write('create-panel', c.createPanelFromTemplateSchema, (tx, b) => s.createPanel(tx, b));
  r.write('create-panels', c.createPanelsFromTemplatesSchema, (tx, b) => s.createPanels(tx, b));
  r.write('unbind', c.unbindSchema, (tx, b) => s.unbind(tx, b.panelId));
  r.write('import', c.importSchema, (tx, b) => s.import(tx, b.doc, b.mode));
  r.write('import-presets', c.importPresetsSchema, (tx) => s.importPresets(tx));
  return r.router;
}
