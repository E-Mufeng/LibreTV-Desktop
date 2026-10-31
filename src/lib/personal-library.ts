import Dexie, { type EntityTable } from 'dexie';
import type { DanmakuRow } from './danmaku';

export interface MediaIdentity {
  title: string;
  year?: string;
  pic?: string;
  sourceKey?: string;
  sourceUrl?: string;
  vodId?: string;
}
export type LibraryFlag = 'saved' | 'liked' | 'watched';
export interface LibraryEntry extends MediaIdentity {
  id: string;
  saved: boolean;
  liked: boolean;
  watched: boolean;
  updatedAt: number;
}

// Additive feature DB: never upgrades/replaces the original history database.
// Older desktop releases can still open their original v3 database on rollback.
export const personalDb = new Dexie('libretv-personal') as Dexie & {
  media: EntityTable<LibraryEntry, 'id'>;
  danmaku: EntityTable<{ id: string; rows: DanmakuRow[]; updatedAt: number }, 'id'>;
};
personalDb.version(1).stores({ media: 'id, updatedAt', danmaku: 'id, updatedAt' });

export function mediaId(media: MediaIdentity): string {
  return JSON.stringify([media.title.normalize('NFKC').trim().toLocaleLowerCase(), media.year?.trim() || '']);
}

export async function findLibraryEntry(media: MediaIdentity): Promise<LibraryEntry | undefined> {
  const exact = await personalDb.media.get(mediaId(media));
  if (exact) return exact;
  const title = mediaId({ title: media.title });
  const candidates = await personalDb.media.filter((item) => mediaId({ title: item.title }) === title && (!media.year || !item.year)).toArray();
  // A yearless catalogue card may reuse one unambiguous saved edition, never guess among remakes.
  return candidates.length === 1 ? candidates[0] : undefined;
}

export async function toggleLibrary(media: MediaIdentity, flag: LibraryFlag): Promise<boolean> {
  if (!media.title.trim() || media.title.length > 300) throw new Error('影片名称不正确');
  if (!['saved', 'liked', 'watched'].includes(flag)) throw new Error('影片操作不正确');
  const id = mediaId(media);
  return personalDb.transaction('rw', personalDb.media, async () => {
    const previous = await findLibraryEntry(media);
    // Callers can pass a whole LibraryEntry. Never spread its stale flags back
    // over the transactional snapshot, or rapid independent toggles lose data.
    const identity: MediaIdentity = { title: media.title, year: media.year, pic: media.pic, sourceKey: media.sourceKey, sourceUrl: media.sourceUrl, vodId: media.vodId };
    const next: LibraryEntry = { saved: false, liked: false, watched: false, ...previous, ...identity, id, updatedAt: Date.now() };
    // Catalogue actions without a source must not erase a previously saved source.
    for (const key of ['sourceKey', 'sourceUrl', 'vodId', 'pic', 'year'] as const) {
      if (!media[key] && previous?.[key]) next[key] = previous[key];
    }
    next[flag] = !next[flag];
    next.id = mediaId(next);
    if (previous && previous.id !== next.id) await personalDb.media.delete(previous.id);
    if (next.saved || next.liked || next.watched) await personalDb.media.put(next);
    else await personalDb.media.delete(next.id);
    return next[flag];
  });
}

export function parseLibraryBackup(value: unknown): LibraryEntry[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('个人片库格式不正确');
  return value.map((row: unknown) => {
    if (!row || typeof row !== 'object') throw new Error('个人片库条目不正确');
    const item = row as Record<string, unknown>;
    if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 300) throw new Error('个人片库片名不正确');
    const media: MediaIdentity = { title: item.title };
    for (const key of ['year', 'pic', 'sourceKey', 'sourceUrl', 'vodId'] as const) {
      if (typeof item[key] === 'string' && item[key].length <= 4096) media[key] = item[key];
    }
    // Never trust a supplied primary key or HTML; UI renders all labels as React text.
    return { ...media, id: mediaId(media), saved: item.saved === true, liked: item.liked === true, watched: item.watched === true, updatedAt: typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now() };
  });
}
