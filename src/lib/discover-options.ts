/** Shared allow-lists for the existing Douban catalogue (no source credentials). */
export const DISCOVER_GENRES = ['全部', '喜剧', '动作', '爱情', '科幻', '悬疑', '犯罪', '惊悚', '恐怖', '剧情', '动画', '纪录片', '战争', '冒险', '家庭', '奇幻', '音乐'];
export const DISCOVER_REGIONS = ['全部', '中国大陆', '香港', '台湾', '美国', '英国', '日本', '韩国', '法国', '印度'];
export const DISCOVER_SORTS = [
  { value: 'T', label: '热门优先' },
  { value: 'S', label: '评分优先' },
  { value: 'R', label: '最新上映' },
];
export const DISCOVER_PAGE_SIZE = 20;
export interface DiscoverQuery {
  type: 'movie' | 'tv';
  genre: string;
  region: string;
  year: string;
  sort: string;
  start: number;
}
export const DEFAULT_DISCOVER_QUERY: DiscoverQuery = {
  type: 'movie', genre: '全部', region: '全部', year: '全部', sort: 'T', start: 0,
};
export function discoverYears(currentYear = new Date().getFullYear()) {
  return [
    { value: '全部', label: '全部' },
    ...Array.from({ length: 5 }, (_, i) => ({ value: String(currentYear - i), label: String(currentYear - i) })),
    ...[2020, 2010, 2000, 1990, 1980].map((year) => ({ value: `${year}s`, label: `${year}年代` })),
    { value: 'earlier', label: '更早' },
  ];
}
