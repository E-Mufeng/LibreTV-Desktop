import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { findLibraryEntry, mediaId, parseLibraryBackup, personalDb, toggleLibrary } from './personal-library';
import { db } from './db';

beforeEach(async () => { await personalDb.media.clear(); await db.history.clear(); });
describe('personal media library persistence', () => {
  it('independently toggles saved, liked and watched, removing only an empty entry', async () => {
    const movie = { title: '喜剧之王', year: '1999' };
    expect(await toggleLibrary(movie, 'saved')).toBe(true);
    await toggleLibrary(movie, 'liked'); await toggleLibrary(movie, 'watched');
    await toggleLibrary(movie, 'saved');
    expect(await personalDb.media.get(mediaId(movie))).toMatchObject({ saved: false, liked: true, watched: true });
    await toggleLibrary(movie, 'liked'); await toggleLibrary(movie, 'watched');
    expect(await personalDb.media.count()).toBe(0);
  });
  it('retains the source when a catalogue card updates a record', async () => {
    await toggleLibrary({ title: '赌神', sourceKey: 'env_2', sourceUrl: 'https://example.com/api', vodId: '14' }, 'saved');
    await toggleLibrary({ title: '赌神' }, 'liked');
    expect(await findLibraryEntry({ title: '赌神' })).toMatchObject({ sourceKey: 'env_2', vodId: '14', saved: true, liked: true });
  });
  it('enriches an unambiguous yearless favourite without duplicating it', async () => {
    await toggleLibrary({ title: '赌神' }, 'saved');
    await toggleLibrary({ title: '赌神', year: '1989' }, 'liked');
    expect(await personalDb.media.count()).toBe(1);
    expect(await findLibraryEntry({ title: '赌神' })).toMatchObject({ year: '1989', saved: true, liked: true });
  });
  it('does not merge differently dated remakes', async () => {
    await toggleLibrary({ title: '同名影片', year: '1980' }, 'saved');
    await toggleLibrary({ title: '同名影片', year: '2020' }, 'saved');
    expect(await personalDb.media.count()).toBe(2);
    expect(await findLibraryEntry({ title: '同名影片' })).toBeUndefined();
  });
  it('keeps concurrent toggles transactional', async () => {
    await Promise.all([toggleLibrary({ title: '并发' }, 'saved'), toggleLibrary({ title: '并发' }, 'liked')]);
    expect(await findLibraryEntry({ title: '并发' })).toMatchObject({ saved: true, liked: true });
  });
  it('ignores stale flag fields from a whole saved card object', async () => {
    await toggleLibrary({ title: '旧卡片' }, 'saved');
    const stale = (await findLibraryEntry({ title: '旧卡片' }))!;
    await toggleLibrary(stale, 'liked');
    await toggleLibrary(stale, 'watched');
    expect(await findLibraryEntry(stale)).toMatchObject({ saved: true, liked: true, watched: true });
  });
  it('reopens the feature database without altering existing history', async () => {
    await db.history.put({ id: 'old_1', sourceKey: 'old', vodId: '1', title: '旧记录', episodeIndex: 2, totalEpisodes: 12, playbackPosition: 53, duration: 1000, timestamp: 100 });
    await toggleLibrary({ title: '保存测试' }, 'saved');
    personalDb.close(); await personalDb.open();
    expect(await personalDb.media.count()).toBe(1);
    expect((await db.history.get('old_1'))?.playbackPosition).toBe(53);
    expect(db.verno).toBe(3);
  });
  it('validates backups and reconstructs keys rather than trusting injected IDs', () => {
    expect(parseLibraryBackup([{ id: 'attacker', title: '影片', saved: true, liked: 'true' }])[0]).toMatchObject({ id: mediaId({ title: '影片' }), saved: true, liked: false });
    expect(() => parseLibraryBackup([{ title: '' }])).toThrow();
    expect(() => parseLibraryBackup({})).toThrow();
  });
});
