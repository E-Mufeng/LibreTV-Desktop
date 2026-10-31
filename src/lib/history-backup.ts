import type { HistoryEntry } from './db';

/** Read both current IndexedDB exports and the pre-IndexedDB export shape. */
export function parseHistoryBackup(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) throw new Error('观看历史格式不正确');
  const number = (v: unknown, defaultValue = 0) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : defaultValue;
  return value.slice(0, 100).flatMap((row: unknown): HistoryEntry[] => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    const sourceKey = String(item.sourceKey || item.sourceCode || item.sourceName || '');
    const vodId = String(item.vodId || item.vod_id || '');
    if (!sourceKey || !vodId) return [];
    return [{ id: `${sourceKey}_${vodId}`, sourceKey, vodId, title: String(item.title || '未知视频').slice(0, 300),
      sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : undefined,
      pic: typeof item.pic === 'string' ? item.pic : undefined,
      episodeIndex: Math.floor(number(item.episodeIndex)),
      totalEpisodes: Math.floor(number(item.totalEpisodes, Array.isArray(item.episodes) ? item.episodes.length : 0)),
      playbackPosition: number(item.playbackPosition), duration: number(item.duration), timestamp: number(item.timestamp, Date.now()),
    }];
  });
}
