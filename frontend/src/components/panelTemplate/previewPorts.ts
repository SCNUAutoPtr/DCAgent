import { generatePorts, type PanelGenerator, type TemplatePortDraft } from '@contracts/panelGenerator';

/** Ports of a generator, or [] while it has issues (the editor lists the issues separately). */
export function previewPorts(gen: PanelGenerator, heightMm: number): TemplatePortDraft[] {
  try {
    return generatePorts(gen, { panelHeightMm: heightMm });
  } catch {
    return [];
  }
}
