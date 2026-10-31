import { expect, it } from 'vitest';
import { parseHistoryBackup } from './history-backup';
it('roundtrips modern history with source, poster, episode and original timestamp', () => {
  const entry = { id: 'env_2_123', sourceKey: 'env_2', sourceUrl: 'https://example.com/api', vodId: '123', title: '赌神', pic: 'https://example.com/p.jpg', episodeIndex: 3, totalEpisodes: 10, playbackPosition: 153, duration: 300, timestamp: 123456 };
  expect(parseHistoryBackup(JSON.parse(JSON.stringify([entry])))).toEqual([entry]);
});
it('accepts legacy backups while dropping invalid rows and non-finite progress', () => {
  const rows = parseHistoryBackup([null, {}, { sourceCode: 'old', vod_id: '1', title: '旧影片', episodes: ['a', 'b'], playbackPosition: NaN }]);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: 'old_1', totalEpisodes: 2, playbackPosition: 0 });
  expect(() => parseHistoryBackup({})).toThrow();
});
