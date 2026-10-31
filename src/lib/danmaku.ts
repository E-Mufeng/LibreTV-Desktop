export interface DanmakuRow { text: string; time: number; mode: 0 | 1 | 2; color: string }
export const MAX_DANMAKU_BYTES = 2 * 1024 * 1024;
export const MAX_DANMAKU_ROWS = 10000;

export function normalizeDanmaku(value: unknown): DanmakuRow[] {
  if (!Array.isArray(value) || value.length > MAX_DANMAKU_ROWS) throw new Error('弹幕应为数组，最多 10000 条');
  const rows = value.map((item: unknown): DanmakuRow => {
    if (!item || typeof item !== 'object') throw new Error('弹幕条目格式不正确');
    const row = item as Record<string, unknown>;
    if (typeof row.text !== 'string' || !row.text.trim() || row.text.length > 100) throw new Error('弹幕文字须为 1–100 字');
    if (typeof row.time !== 'number' || !Number.isFinite(row.time) || row.time < 0 || row.time > 172800) throw new Error('弹幕时间不正确');
    return { text: row.text, time: row.time, mode: row.mode === 1 || row.mode === 2 ? row.mode : 0, color: typeof row.color === 'string' && /^#[\da-f]{6}$/i.test(row.color) ? row.color : '#ffffff' };
  });
  return rows.sort((a, b) => a.time - b.time);
}

export function parseDanmakuFile(text: string, filename: string): DanmakuRow[] {
  if (new TextEncoder().encode(text).length > MAX_DANMAKU_BYTES) throw new Error('弹幕文件上限为 2 MiB');
  if (!filename.toLowerCase().endsWith('.xml')) return normalizeDanmaku(JSON.parse(text));
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('弹幕 XML 不接受外部实体');
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('弹幕 XML 解析失败');
  const items = [...document.querySelectorAll('d')];
  if (!items.length) throw new Error('XML 中没有 Bilibili 格式的弹幕条目');
  return normalizeDanmaku(items.map((item) => {
    const fields = (item.getAttribute('p') || '').split(',');
    const color = Number(fields[3]);
    return { text: item.textContent, time: fields[0] ? Number(fields[0]) : NaN, mode: fields[1] === '5' ? 1 : fields[1] === '4' ? 2 : 0, color: Number.isInteger(color) && color >= 0 && color <= 0xffffff ? `#${color.toString(16).padStart(6, '0')}` : '#ffffff' };
  }));
}

export function offsetDanmaku(rows: DanmakuRow[], offset: number): DanmakuRow[] {
  return rows.map((row) => ({ ...row, time: Math.max(0, row.time + offset) }));
}
