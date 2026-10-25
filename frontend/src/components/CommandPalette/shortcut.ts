/** Mac shows the command key, everything else Ctrl. */
export const isMac = (): boolean => {
  try {
    return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  } catch {
    return false;
  }
};

export const paletteShortcut = (): string => (isMac() ? '⌘K' : 'Ctrl K');
