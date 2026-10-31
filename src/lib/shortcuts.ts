export function appShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'repeat' | 'isComposing'>, editing: boolean): 'search' | 'library' | 'history' | 'help' | null {
  if (event.repeat || event.isComposing || editing || event.altKey) return null;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === 'k') return 'search';
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'l') return 'library';
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'h') return 'history';
  if (!event.ctrlKey && !event.metaKey && (event.key === '?' || event.key === '/')) return event.key === '?' ? 'help' : 'search';
  return null;
}
