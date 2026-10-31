import { expect, it } from 'vitest';
import { normalizeDanmaku, offsetDanmaku, parseDanmakuFile } from './danmaku';
it('sorts, sanitizes and bounds imported comments without accepting HTML/style options', () => {
  const result = normalizeDanmaku([{ text: '<img src=x onerror=alert(1)>', time: 10, style: { display: 'none' }, color: 'red', mode: 8 }, { text: '正常', time: 2, color: '#00ff00', mode: 1 }]);
  expect(result[0]).toEqual({ text: '正常', time: 2, color: '#00ff00', mode: 1 });
  expect(result[1]).not.toHaveProperty('style');
  expect(result[1].color).toBe('#ffffff');
});
it('rejects malformed data, oversized input and XML entities before parsing', () => {
  for (const data of [{}, [{ time: -1, text: 'a' }], [{ time: Infinity, text: 'a' }], [{ time: 2, text: '' }], new Array(10001)]) expect(() => normalizeDanmaku(data)).toThrow();
  expect(() => parseDanmakuFile('x'.repeat(2 * 1024 * 1024 + 1), 'test.json')).toThrow('2 MiB');
  expect(() => parseDanmakuFile('<!DOCTYPE x><i/>', 'test.xml')).toThrow('外部实体');
});
it('parses JSON and supports positive/negative timeline offsets', () => {
  const rows = parseDanmakuFile('[{"time":2,"text":"测试"}]', 'test.json');
  expect(offsetDanmaku(rows, -5)[0].time).toBe(0);
  expect(offsetDanmaku(rows, 4)[0].time).toBe(6);
  expect(rows[0].time).toBe(2);
});
