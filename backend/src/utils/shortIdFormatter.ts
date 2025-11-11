/**
 * ShortID 格式化工具
 *
 * 格式定义：
 * - 显示格式：E-XXXXX（例如 E-00001, E-12345, E-123456）
 * - E 代表 Entity
 * - 数字部分最少5位，不足补0；超过5位则正常显示
 * - 数据库存储：纯数字（例如 1, 12345, 123456）
 */

export class ShortIdFormatter {
  private static readonly PREFIX = 'E-';
  private static readonly MIN_PADDING_LENGTH = 5;

  /**
   * 将数字shortID转换为显示格式
   * @param numericId 数字shortID（例如 1, 123456）
   * @returns 显示格式shortID（例如 "E-00001", "E-123456"）
   */
  static toDisplayFormat(numericId: number): string {
    const numStr = String(numericId);
    // 如果数字长度小于最小长度，则补0；否则直接使用
    const paddedNumber = numStr.length < this.MIN_PADDING_LENGTH
      ? numStr.padStart(this.MIN_PADDING_LENGTH, '0')
      : numStr;
    return `${this.PREFIX}${paddedNumber}`;
  }

  /**
   * 将显示格式shortID转换为数字
   * @param displayId 显示格式shortID（例如 "E-00001" 或 "00001"）
   * @returns 数字shortID（例如 1）
   */
  static toNumericFormat(displayId: string): number {
    // 移除前缀（如果存在）
    const numericPart = displayId.replace(this.PREFIX, '').trim();
    const parsed = parseInt(numericPart, 10);

    if (isNaN(parsed)) {
      throw new Error(`无效的shortID格式: ${displayId}`);
    }

    return parsed;
  }

  /**
   * 验证显示格式shortID是否有效
   * @param displayId 显示格式shortID
   * @returns 是否有效
   */
  static isValidDisplayFormat(displayId: string): boolean {
    const regex = new RegExp(`^${this.PREFIX}\\d+$`);
    return regex.test(displayId);
  }

  /**
   * 批量转换为显示格式
   * @param numericIds 数字shortID数组
   * @returns 显示格式shortID数组
   */
  static batchToDisplayFormat(numericIds: number[]): string[] {
    return numericIds.map(id => this.toDisplayFormat(id));
  }

  /**
   * 批量转换为数字格式
   * @param displayIds 显示格式shortID数组
   * @returns 数字shortID数组
   */
  static batchToNumericFormat(displayIds: string[]): number[] {
    return displayIds.map(id => this.toNumericFormat(id));
  }

  /**
   * 解析shortID范围表达式
   * 支持格式：
   * - 单个：1 或 E-00001
   * - 范围：1-5 或 E-00001-E-00005
   * - 多个：1, 3, 5 或 E-00001, E-00003, E-00005
   * - 组合：1-5, 8, 10-12 或 E-00001-E-00005, E-00008, E-00010-E-00012
   *
   * @param rangeExpr 范围表达式（例如 "1-5, 8, 10-12"）
   * @returns 解析后的shortID数组（去重并排序）
   */
  static parseRangeExpression(rangeExpr: string): number[] {
    const result = new Set<number>();

    // 按逗号分割各个部分
    const parts = rangeExpr.split(',').map(p => p.trim()).filter(p => p.length > 0);

    for (const part of parts) {
      // 检查是否是范围（包含 "-"）
      if (part.includes('-')) {
        // 分割起止值
        const [startStr, endStr] = part.split('-').map(s => s.trim());

        // 转换为数字格式
        const start = this.toNumericFormat(startStr);
        const end = this.toNumericFormat(endStr);

        if (start > end) {
          throw new Error(`无效的范围: ${part} (起始值必须小于等于结束值)`);
        }

        // 添加范围内的所有数字
        for (let i = start; i <= end; i++) {
          result.add(i);
        }
      } else {
        // 单个值
        result.add(this.toNumericFormat(part));
      }
    }

    // 转换为数组并排序
    return Array.from(result).sort((a, b) => a - b);
  }

  /**
   * 验证范围表达式格式
   * @param rangeExpr 范围表达式
   * @returns 是否有效
   */
  static isValidRangeExpression(rangeExpr: string): boolean {
    try {
      this.parseRangeExpression(rangeExpr);
      return true;
    } catch {
      return false;
    }
  }
}

// 便捷导出
export const formatShortId = ShortIdFormatter.toDisplayFormat;
export const parseShortId = ShortIdFormatter.toNumericFormat;
