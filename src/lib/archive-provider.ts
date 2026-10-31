import type { SearchResultItem, SourceConfig, VideoDetail } from './types';
import { fetchUpstream } from './fetch-utils';

export const ARCHIVE_SOURCE_URL = 'https://archive.org/advancedsearch.php';
export function isArchiveSource(url: string): boolean { return url.replace(/\/+$/, '') === ARCHIVE_SOURCE_URL; }
const validId = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,150}$/.test(value);

export function parseArchiveSearch(value: unknown, source: SourceConfig): SearchResultItem[] {
  const docs = (value as { response?: { docs?: unknown } })?.response?.docs;
  if (!Array.isArray(docs)) throw new Error('Internet Archive 返回的搜索格式不正确');
  return docs.slice(0, 40).flatMap((row: unknown) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    if (!validId(item.identifier) || typeof item.title !== 'string' || !item.title.trim()) return [];
    return [{ sourceKey: source.key, sourceName: source.name, sourceUrl: source.url, vodId: item.identifier,
      name: item.title.slice(0, 300), pic: `https://archive.org/services/img/${item.identifier}`,
      year: typeof item.year === 'string' || typeof item.year === 'number' ? String(item.year).slice(0, 4) : undefined,
      typeName: '开放电影/动画', remarks: 'Internet Archive · 公开视频；具体可播文件以详情为准',
    }];
  });
}

export async function searchArchive(source: SourceConfig, keyword: string, signal?: AbortSignal): Promise<SearchResultItem[]> {
  const phrase = keyword.replace(/["\\]/g, ' ').trim().slice(0, 100);
  const url = new URL(ARCHIVE_SOURCE_URL);
  url.search = new URLSearchParams({ q: `mediatype:movies AND (collection:feature_films OR collection:animationandcartoons OR collection:opensource_movies) AND title:("${phrase}") AND NOT access-restricted-item:true`, output: 'json', rows: '40', 'fl[]': 'identifier,title,year', 'sort[]': 'downloads desc' }).toString();
  const response = await fetchUpstream(url.toString(), { timeoutMs: 8000, retries: 0, signal });
  if (!response.ok) throw new Error(`Internet Archive 搜索 HTTP ${response.status}`);
  return parseArchiveSearch(await response.json(), source);
}

export function parseArchiveDetail(value: unknown, id: string, source: SourceConfig): VideoDetail {
  if (!validId(id)) throw new Error('Internet Archive 视频ID不正确');
  const item = value as { is_dark?: boolean; metadata?: Record<string, unknown>; files?: Record<string, unknown>[] };
  const metadata = item?.metadata;
  if (!metadata || !Array.isArray(item.files)) throw new Error('Internet Archive 详情格式不正确');
  if (item.is_dark || metadata['access-restricted-item'] === true || metadata['access-restricted-item'] === 'true') throw new Error('该条目不是公开可播放资源');
  // One browser-compatible derivative per original file. Do not turn different
  // resolutions of the same film into fake episodes, or include private files.
  const files = new Map<string, { name: string; score: number }>();
  for (const file of item.files) {
    if (file.private === true || file.private === 'true' || typeof file.name !== 'string' || file.name.length > 1000 || !/\.mp4$/i.test(file.name)) continue;
    if (file.name.startsWith('/') || file.name.includes('\\') || file.name.split('/').includes('..')) continue;
    const format = String(file.format || '');
    if (!/h\.264|mpeg4/i.test(format)) continue;
    const key = typeof file.original === 'string' ? file.original : file.name.replace(/(?:\.ia|_512kb)\.mp4$/i, '');
    const score = /512kb/i.test(format) ? 3 : /h\.264/i.test(format) ? 2 : 1;
    if (!files.has(key) || files.get(key)!.score < score) files.set(key, { name: file.name, score });
    if (files.size > 100) throw new Error('该条目的视频文件过多，请选择更具体的影片');
  }
  const selected = [...files.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  if (!selected.length) throw new Error('该条目没有公开的兼容MP4文件');
  return { episodes: selected.map((file) => `https://archive.org/download/${id}/${file.name.split('/').map(encodeURIComponent).join('/')}`),
    videoInfo: { title: typeof metadata.title === 'string' ? metadata.title : id,
      cover: `https://archive.org/services/img/${id}`, desc: typeof metadata.description === 'string' ? metadata.description.replace(/<[^>]*>/g, '').slice(0, 3000) : undefined,
      year: metadata.year ? String(metadata.year).slice(0, 4) : undefined, typeName: '开放电影/动画', remarks: `公开视频 · ${selected.length} 个可播放文件`,
      sourceKey: source.key, sourceName: source.name, sourceUrl: source.url },
  };
}

export async function detailArchive(source: SourceConfig, id: string, signal?: AbortSignal): Promise<VideoDetail> {
  if (!validId(id)) throw new Error('Internet Archive 视频ID不正确');
  const response = await fetchUpstream(`https://archive.org/metadata/${id}`, { timeoutMs: 10000, retries: 0, signal });
  if (!response.ok) throw new Error(`Internet Archive 详情 HTTP ${response.status}`);
  return parseArchiveDetail(await response.json(), id, source);
}
