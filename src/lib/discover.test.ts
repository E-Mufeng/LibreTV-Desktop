import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDiscoverUrl, fetchDiscover, parseDiscoverItems, parseDiscoverQuery } from './discover';
import { DEFAULT_DISCOVER_QUERY } from './discover-options';
import { fetchUpstream, getCache, setCache } from './fetch-utils';

vi.mock('./fetch-utils', () => ({ fetchUpstream: vi.fn(), getCache: vi.fn(), setCache: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

describe('组合分类目录', () => {
  it('默认参数与页码有界，未知条件不静默变成其他查询', () => {
    expect(parseDiscoverQuery(new URLSearchParams(), 2026)).toEqual(DEFAULT_DISCOVER_QUERY);
    for (const bad of ['type=live', 'genre=foo', 'region=foo', 'year=3000', 'sort=foo', 'start=-20', 'start=1', 'start=1020', 'start=NaN']) {
      expect(() => parseDiscoverQuery(new URLSearchParams(bad), 2026)).toThrow();
    }
  });
  it('电影、喜剧、地区和年代真正组合下发，而非拼接搜索词', () => {
    const query = parseDiscoverQuery(new URLSearchParams({ type: 'movie', genre: '喜剧', region: '中国大陆', year: '2010s', sort: 'S', start: '20' }), 2026);
    const url = new URL(buildDiscoverUrl(query, 2026));
    expect(url.origin + url.pathname).toBe('https://movie.douban.com/j/new_search_subjects');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ tags: '电影,喜剧,中国大陆', year_range: '2010,2019', sort: 'S', start: '20' });
    expect(url.searchParams.has('wd')).toBe(false);
  });
  it('单年、当前年代、早期年份和电视剧类型均转换准确', () => {
    for (const [year, range] of [['2025', '2025,2025'], ['2020s', '2020,2026'], ['earlier', '1900,1979']]) {
      const url = new URL(buildDiscoverUrl({ ...DEFAULT_DISCOVER_QUERY, type: 'tv', year }, 2026));
      expect(url.searchParams.get('year_range')).toBe(range);
      expect(url.searchParams.get('tags')).toBe('电视剧');
    }
    expect(new URL(buildDiscoverUrl(DEFAULT_DISCOVER_QUERY)).searchParams.has('year_range')).toBe(false);
  });
  it('解析目录卡片，丢弃坏id和标题，不把任意协议当封面地址', () => {
    expect(parseDiscoverItems({ data: [{ id: '123', title: '喜剧', cover: 'https://img.test/a.jpg', rate: '8.1' }, { id: 'invalid', title: 'x' }, { id: 42, title: '' }, null] }, true)).toEqual([
      { id: '123', title: '喜剧', cover: 'https://img.test/a.jpg', rating: '8.1', isTv: true },
    ]);
    expect(parseDiscoverItems({ data: [{ id: 2, title: 'x', cover: 'javascript:x', rate: '0' }] }, false)[0]).toMatchObject({ cover: '', rating: undefined });
    expect(() => parseDiscoverItems({ error: 'blocked' }, false)).toThrow();
  });
  it('固定上游，复用安全请求与短缓存，未加入第三方中转', async () => {
    vi.mocked(fetchUpstream).mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 1, title: 'x' }] })));
    const result = await fetchDiscover(DEFAULT_DISCOVER_QUERY);
    expect(result.hasMore).toBe(false);
    expect(fetchUpstream).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/movie\.douban\.com\/j\/new_search_subjects\?/), expect.objectContaining({ timeoutMs: 8000, retries: 0 }));
    expect(setCache).toHaveBeenCalledWith(expect.any(String), result, 600000);
    vi.mocked(getCache).mockReturnValue(result);
    expect(await fetchDiscover(DEFAULT_DISCOVER_QUERY)).toEqual(result);
    expect(fetchUpstream).toHaveBeenCalledTimes(1);
  });
  it('上游失败保留真实错误，不返回伪造的空成功结果', async () => {
    vi.mocked(fetchUpstream).mockResolvedValue(new Response('blocked', { status: 403 }));
    await expect(fetchDiscover(DEFAULT_DISCOVER_QUERY)).rejects.toThrow('403');
    expect(setCache).not.toHaveBeenCalled();
  });
});
