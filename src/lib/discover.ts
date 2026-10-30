import type { DoubanItem } from './types';
import { fetchUpstream, getCache, setCache } from './fetch-utils';
import { DEFAULT_DISCOVER_QUERY, DISCOVER_GENRES, DISCOVER_REGIONS, DISCOVER_SORTS, DISCOVER_PAGE_SIZE, discoverYears, type DiscoverQuery } from './discover-options';

export function parseDiscoverQuery(params: URLSearchParams, currentYear = new Date().getFullYear()): DiscoverQuery {
  const query = { ...DEFAULT_DISCOVER_QUERY };
  const type = params.get('type') ?? query.type;
  if (type !== 'movie' && type !== 'tv') throw new Error('不支持的影片类型');
  query.type = type;
  for (const [key, allowed] of [
    ['genre', DISCOVER_GENRES], ['region', DISCOVER_REGIONS],
    ['year', discoverYears(currentYear).map((x) => x.value)], ['sort', DISCOVER_SORTS.map((x) => x.value)],
  ] as const) {
    const value = params.get(key) ?? query[key];
    if (!allowed.includes(value)) throw new Error(`不支持的筛选条件：${key}`);
    query[key] = value;
  }
  const start = Number(params.get('start') ?? 0);
  if (!Number.isInteger(start) || start < 0 || start > 1000 || start % DISCOVER_PAGE_SIZE !== 0) throw new Error('无效的分页位置');
  query.start = start;
  return query;
}

export function buildDiscoverUrl(query: DiscoverQuery, currentYear = new Date().getFullYear()): string {
  const tags = [query.type === 'movie' ? '电影' : '电视剧', query.genre, query.region].filter((x) => x !== '全部');
  const params = new URLSearchParams({ tags: tags.join(','), sort: query.sort, range: '0,10', start: String(query.start) });
  if (query.year !== '全部') {
    const first = query.year === 'earlier' ? 1900 : parseInt(query.year, 10);
    const last = query.year === 'earlier' ? 1979 : query.year.endsWith('s') ? Math.min(first + 9, currentYear) : first;
    params.set('year_range', `${first},${last}`);
  }
  // A fixed operator host, never a caller-provided URL or public CORS relay.
  return `https://movie.douban.com/j/new_search_subjects?${params}`;
}

export function parseDiscoverItems(data: unknown, isTv: boolean): DoubanItem[] {
  const list = (data as { data?: unknown } | null)?.data;
  if (!Array.isArray(list)) throw new Error('分类目录返回了无效数据');
  return list.slice(0, DISCOVER_PAGE_SIZE).flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Record<string, unknown>;
    if (!/^\d+$/.test(String(item.id ?? '')) || typeof item.title !== 'string' || !item.title.trim()) return [];
    return [{
      id: String(item.id), title: item.title.trim(),
      cover: typeof item.cover === 'string' && /^https?:\/\//.test(item.cover) ? item.cover : '',
      rating: typeof item.rate === 'string' && item.rate !== '0' ? item.rate : undefined,
      isTv,
    }];
  });
}

export async function fetchDiscover(query: DiscoverQuery) {
  const target = buildDiscoverUrl(query);
  const key = `discover:${target}`;
  const cached = getCache<{ items: DoubanItem[]; hasMore: boolean }>(key);
  if (cached) return cached;
  const response = await fetchUpstream(target, {
    timeoutMs: 8000, retries: 0,
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://movie.douban.com/', Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`分类目录请求失败（HTTP ${response.status}）`);
  const data = await response.json();
  const items = parseDiscoverItems(data, query.type === 'tv');
  const result = { items, hasMore: Array.isArray(data.data) && data.data.length >= DISCOVER_PAGE_SIZE };
  setCache(key, result, 10 * 60 * 1000);
  return result;
}
