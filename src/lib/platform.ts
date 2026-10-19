export const isMac = () => typeof window !== 'undefined' && window.desktop?.platform === 'darwin';

export function shortcutLabel(label: string) {
  if (!isMac()) return label;
  return label.replaceAll('Ctrl+Y', '⌘⇧Z').replaceAll('Ctrl + Y', '⌘ ⇧ Z')
    .replaceAll('Ctrl+', '⌘').replaceAll('Ctrl +', '⌘ +');
}
