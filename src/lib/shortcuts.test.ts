import { expect, it } from 'vitest';
import { appShortcut } from './shortcuts';
const base = { key: '/', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, isComposing: false };
it('resolves app navigation and search bindings', () => {
  expect(appShortcut(base, false)).toBe('search');
  expect(appShortcut({ ...base, key: 'K', ctrlKey: true }, false)).toBe('search');
  expect(appShortcut({ ...base, key: 'L', metaKey: true, shiftKey: true }, false)).toBe('library');
  expect(appShortcut({ ...base, key: 'H', ctrlKey: true, shiftKey: true }, false)).toBe('history');
  expect(appShortcut({ ...base, key: '?' }, false)).toBe('help');
});
it('never hijacks input, IME, repeated presses, Alt navigation or unassigned keys', () => {
  expect(appShortcut(base, true)).toBeNull();
  for (const override of [{ isComposing: true }, { repeat: true }, { altKey: true }, { key: 'h' }, { key: 'ArrowRight' }]) expect(appShortcut({ ...base, ...override }, false)).toBeNull();
});
