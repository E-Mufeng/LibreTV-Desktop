import { describe, expect, it, vi } from 'vitest';
import { ARCHIVE_SOURCE_URL, isArchiveSource, parseArchiveDetail, parseArchiveSearch, searchArchive, detailArchive } from './archive-provider';
import { fetchUpstream } from './fetch-utils';
vi.mock('./fetch-utils', () => ({ fetchUpstream: vi.fn() }));
const source = { key: 'archive', name: 'Internet Archive', url: ARCHIVE_SOURCE_URL };
describe('Internet Archive provider', () => {
  it('recognizes only the exact configured public endpoint, not deceptive hosts or queries', () => {
    expect(isArchiveSource(ARCHIVE_SOURCE_URL + '/')).toBe(true);
    for (const url of ['https://archive.org.evil.test/advancedsearch.php', ARCHIVE_SOURCE_URL + '?url=http://localhost', 'http://archive.org/advancedsearch.php']) expect(isArchiveSource(url)).toBe(false);
  });
  it('normalizes search results, dropping malformed IDs and non-video labels', () => {
    const rows = parseArchiveSearch({ response: { docs: [{ identifier: 'BigBuckBunny_328', title: 'Big Buck Bunny', year: 2008 }, { identifier: '../../x', title: 'x' }, { identifier: 'id', title: [] }] } }, source);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sourceKey: 'archive', vodId: 'BigBuckBunny_328', name: 'Big Buck Bunny', year: '2008' });
    expect(() => parseArchiveSearch({}, source)).toThrow();
  });
  it('selects compatible public files and de-duplicates resolutions without false episodes', () => {
    const data = { metadata: { title: 'Open film' }, files: [
      { name: 'film.mp4', format: 'MPEG4' }, { name: 'film.ia.mp4', original: 'film.mp4', format: 'h.264 IA' },
      { name: 'private.mp4', format: 'MPEG4', private: 'true' }, { name: '../escape.mp4', format: 'MPEG4' },
      { name: '02 another.mp4', format: '512Kb MPEG4' }, { name: 'unplayable.avi', format: 'AVI' },
    ] };
    const detail = parseArchiveDetail(data, 'film-id', source);
    expect(detail.episodes).toEqual(['https://archive.org/download/film-id/02%20another.mp4', 'https://archive.org/download/film-id/film.ia.mp4']);
  });
  it('rejects restricted items, unsafe IDs, malformed metadata and non-playable collections', () => {
    expect(() => parseArchiveDetail({ metadata: { 'access-restricted-item': 'true' }, files: [] }, 'film', source)).toThrow('公开');
    expect(() => parseArchiveDetail({ is_dark: true, metadata: {}, files: [] }, 'film', source)).toThrow();
    expect(() => parseArchiveDetail({}, '../secret', source)).toThrow();
    expect(() => parseArchiveDetail({}, 'valid', source)).toThrow();
    expect(() => parseArchiveDetail({ metadata: {}, files: [] }, 'valid', source)).toThrow('MP4');
  });
  it('queries a fixed provider URL with bounded phrase search and the caller abort signal', async () => {
    vi.mocked(fetchUpstream).mockResolvedValueOnce(Response.json({ response: { docs: [] } }));
    const signal = new AbortController().signal;
    await searchArchive(source, 'Big Buck Bunny" OR mediatype:texts', signal);
    const [url, options] = vi.mocked(fetchUpstream).mock.calls.at(-1)!;
    expect(new URL(url).origin).toBe('https://archive.org');
    expect(new URL(url).searchParams.get('rows')).toBe('40');
    expect(options?.signal).toBe(signal);
    expect(new URL(url).searchParams.get('q')).toContain('NOT access-restricted-item:true');
  });
  it('does not issue a request for an unsafe item ID and propagates provider failures', async () => {
    const before = vi.mocked(fetchUpstream).mock.calls.length;
    await expect(detailArchive(source, '../file')).rejects.toThrow();
    expect(vi.mocked(fetchUpstream).mock.calls.length).toBe(before);
    vi.mocked(fetchUpstream).mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(searchArchive(source, 'film')).rejects.toThrow('503');
  });
});
