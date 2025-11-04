/**
 * 面板相关工具函数
 */

// 标准1U高度（毫米）
const STANDARD_1U_HEIGHT = 44.45;

/**
 * 根据高度（mm）计算U数
 * @param heightMm 高度（毫米）
 * @returns U数（保留1位小数）
 */
export function calculateUFromHeight(heightMm: number): number {
  return Math.round((heightMm / STANDARD_1U_HEIGHT) * 10) / 10;
}

/**
 * 格式化尺寸显示，自动添加U数标注
 * @param width 宽度（mm）
 * @param height 高度（mm）
 * @returns 格式化的尺寸字符串，例如："482.6 × 44.45 mm (1U)"
 */
export function formatPanelSize(width: number, height: number): string {
  const uCount = calculateUFromHeight(height);
  const uLabel = uCount === 1 ? '1U' : `${uCount}U`;
  return `${width} × ${height} mm (${uLabel})`;
}

/**
 * 根据U数计算高度（mm）
 * @param uCount U数
 * @returns 高度（毫米）
 */
export function calculateHeightFromU(uCount: number): number {
  return Math.round(uCount * STANDARD_1U_HEIGHT * 100) / 100;
}
