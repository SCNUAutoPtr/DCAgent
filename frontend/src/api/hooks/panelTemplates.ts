import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { In } from '@/services/api';
import type { templateListSchema } from '@contracts/panelTemplates';
import { panelTemplateService as s } from '@/services/panelTemplateService';

type ListBody = In<typeof templateListSchema>;

/** panel-templates/list; pass enabled: false until the filter is known. */
export function usePanelTemplates(body: ListBody = {}, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['panel-templates', 'list', body],
    queryFn: () => s.list(body),
    enabled: opts.enabled ?? true,
  });
}

export function usePanelTemplate(id: string | null) {
  const body = { id: id ?? '' };
  return useQuery({
    queryKey: ['panel-templates', 'get', body],
    queryFn: () => s.get(body),
    enabled: !!id,
  });
}

export function useApplyPreview(templateId: string | null, panelId: string | null) {
  const body = { templateId: templateId ?? '', panelId: panelId ?? '' };
  return useQuery({
    queryKey: ['panel-templates', 'apply-preview', body],
    queryFn: () => s.applyPreview(body),
    enabled: !!templateId && !!panelId,
    staleTime: 0,
  });
}

export function useBatchPreview(templateId: string | null) {
  const body = { templateId: templateId ?? '' };
  return useQuery({
    queryKey: ['panel-templates', 'batch-preview', body],
    queryFn: () => s.batchPreview(body),
    enabled: !!templateId,
    staleTime: 0,
  });
}

/** Writes to templates also change panels and ports (apply, create-panel), so those are invalidated too. */
function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ['panel-templates', 'panels', 'ports', 'devices', 'device-models', 'cabinets', 'rooms'].map((r) => qc.invalidateQueries({ queryKey: [r] })),
    );
}

function useWrite<A, R>(fn: (arg: A) => Promise<R>) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidate() });
}

export const useCreateTemplate = () => useWrite(s.create);
export const useUpdateTemplate = () => useWrite(s.update);
export const useDeleteTemplate = () => useWrite(s.delete);
/** silent: the caller shows conflicts itself */
export const useApplyTemplate = () => useWrite((b: Parameters<typeof s.apply>[0]) => s.apply(b, { silent: true }));
export const useBatchApplyTemplate = () => useWrite((b: Parameters<typeof s.batchApply>[0]) => s.batchApply(b, { silent: true }));
export const useCreatePanelsFromTemplates = () => useWrite(s.createPanels);
export const useImportTemplates = () => useWrite(s.import);
export const useImportPresets = () => useWrite(() => s.importPresets());
