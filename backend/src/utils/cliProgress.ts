export function formatProgressBar(completed: number, total: number, width: number = 20): string {
  const safeTotal = total <= 0 ? 1 : total;
  const ratio = Math.max(0, Math.min(1, completed / safeTotal));
  const filled = Math.round(ratio * width);
  return `${'#'.repeat(filled)}${'-'.repeat(width - filled)}`;
}

export function formatProgressLine(params: {
  phase: string;
  completed: number;
  total: number;
  label?: string;
  width?: number;
}): string {
  const { phase, completed, total, label, width = 20 } = params;
  const safeTotal = total <= 0 ? 1 : total;
  const percent = Math.round((Math.max(0, Math.min(completed, safeTotal)) / safeTotal) * 100);
  const bar = formatProgressBar(completed, safeTotal, width);
  const tail = label ? ` ${label}` : '';
  return `${phase} [${bar}] ${completed}/${safeTotal} ${percent}%${tail}`;
}
