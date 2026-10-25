/** "2U", or the given text when the height is not known (null). */
export function uHeightText(uHeight: number | null, unknownText: string): string {
  return uHeight === null ? unknownText : `${uHeight}U`;
}
