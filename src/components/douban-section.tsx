'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/client-api';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { DoubanItem } from '@/lib/types';
import { DoubanCard } from './video-card';
import { DEFAULT_DISCOVER_QUERY, DISCOVER_GENRES, DISCOVER_REGIONS, DISCOVER_SORTS, DISCOVER_PAGE_SIZE, discoverYears, type DiscoverQuery } from '@/lib/discover-options';

const MOVIE_TAGS = ['热门', '最新', '经典', '豆瓣高分', '冷门佳片', '华语', '欧美', '韩国', '日本', '动画'];
const TV_TAGS = ['热门', '美剧', '英剧', '韩剧', '日剧', '国产剧', '港剧', '日本动画', '综艺', '纪录片'];
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 首页推荐区：数据源由设置决定（豆瓣热门 / Bangumi 新番放送 / 影视热榜），二选一展示 */
export function RecommendSection({ onPick }: { onPick: (title: string) => void }) {
  const doubanEnabled = useAppStore((s) => s.doubanEnabled);
  const recommendSource = useAppStore((s) => s.recommendSource);
  const [mode, setMode] = useState<'discover' | 'recommend'>('discover');

  if (!doubanEnabled) return null;
  return (
    <div>
      <div className="flex gap-2 mb-4" aria-label="发现影片">
        <TypeButton active={mode === 'discover'} onClick={() => setMode('discover')}>分类选片</TypeButton>
        <TypeButton active={mode === 'recommend'} onClick={() => setMode('recommend')}>热门推荐</TypeButton>
      </div>
      {mode === 'discover' ? <DiscoverView onPick={onPick} />
        : recommendSource === 'bangumi' ? <BangumiView onPick={onPick} />
        : recommendSource === 'hot-list' ? <HotListView onPick={onPick} />
        : <DoubanView onPick={onPick} />}
    </div>
  );
}

/** Real catalogue filters; never turn “喜剧 + 年代” into an unrelated keyword search. */
function DiscoverView({ onPick }: { onPick: (title: string) => void }) {
  const [filters, setFilters] = useState<DiscoverQuery>({ ...DEFAULT_DISCOVER_QUERY });
  const query = useQuery({ queryKey: ['discover', filters], queryFn: ({ signal }) => api.discover(filters, signal) });
  const change = (patch: Partial<DiscoverQuery>) => setFilters((previous) => ({ ...previous, ...patch, start: 0 }));
  const years = discoverYears();
  const rows = [
    { key: 'type', label: '类型', values: [{ value: 'movie', label: '电影' }, { value: 'tv', label: '电视剧' }] },
    { key: 'genre', label: '题材', values: DISCOVER_GENRES.map((value) => ({ value, label: value })) },
    { key: 'region', label: '地区', values: DISCOVER_REGIONS.map((value) => ({ value, label: value })) },
    { key: 'year', label: '年代', values: years },
    { key: 'sort', label: '排序', values: DISCOVER_SORTS },
  ] as const;
  return (
    <section aria-label="分类选片片库">
      <div className="rounded-xl border border-line bg-surface-raised p-3 sm:p-4 mb-4 space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="flex gap-3 items-start" role="group" aria-label={row.label}>
            <span className="text-xs text-faint shrink-0 pt-1 w-7">{row.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {row.values.map((option) => (
                <ChipButton key={option.value} active={filters[row.key] === option.value} onClick={() => change({ [row.key]: option.value })}>{option.label}</ChipButton>
              ))}
            </div>
          </div>
        ))}
        <div className="flex justify-between gap-2 text-xs text-faint border-t border-line pt-3">
          <span>分类目录来自豆瓣；点选海报后从已启用点播源查找，目录收录不代表一定有片源。</span>
          <button className="text-accent shrink-0" onClick={() => setFilters({ ...DEFAULT_DISCOVER_QUERY })}>重置筛选</button>
        </div>
      </div>
      {query.isError ? (
        <div role="alert" className="text-center text-sm text-faint py-8">
          <p>{query.error.message}</p>
          <button className="btn-ghost btn-sm mt-3" onClick={() => void query.refetch()}>重新加载分类目录</button>
        </div>
      ) : query.isLoading ? <GridSkeleton /> : (query.data?.items.length ?? 0) === 0 ? (
        <p className="text-center text-sm text-faint py-8">当前组合暂无影片，可更换筛选条件。</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {query.data?.items.map((item) => <DoubanCard key={item.id} item={item} onClick={() => onPick(item.title)} />)}
        </div>
      )}
      {!query.isError && (
        <div className="flex justify-center items-center gap-4 mt-5">
          <button className="btn-ghost btn-sm" disabled={query.isFetching || filters.start === 0} onClick={() => setFilters((previous) => ({ ...previous, start: previous.start - DISCOVER_PAGE_SIZE }))}>上一页</button>
          <span className="text-xs text-muted">第 {filters.start / DISCOVER_PAGE_SIZE + 1} 页</span>
          <button className="btn-ghost btn-sm" disabled={query.isFetching || !query.data?.hasMore || filters.start >= 1000} onClick={() => setFilters((previous) => ({ ...previous, start: previous.start + DISCOVER_PAGE_SIZE }))}>下一页</button>
        </div>
      )}
    </section>
  );
}

/**
 * 豆瓣推荐：影视切换 + 标签筛选。
 * 一次性渲染全部条目：数据本就一次拉全（50 条），卡片图片又是 lazy 加载，
 * 视口外的图不会请求，因此不需要「加载更多」这类本地切片分页来打断浏览。
 */
function DoubanView({ onPick }: { onPick: (title: string) => void }) {
  const [type, setType] = useState<'movie' | 'tv'>('movie');
  const [tag, setTag] = useState('热门');

  const query = useQuery({
    queryKey: ['douban', type, tag],
    queryFn: ({ signal }) => api.douban(type, tag, 0, 50, signal),
  });

  const tags = type === 'movie' ? MOVIE_TAGS : TV_TAGS;
  const items = query.data?.items ?? [];

  const switchType = (t: 'movie' | 'tv') => {
    if (t === type) return;
    setType(t);
    setTag('热门');
  };

  return (
    <section aria-label="影视推荐">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex bg-chip rounded-lg p-0.5">
            <TypeButton active={type === 'movie'} onClick={() => switchType('movie')}>
              电影
            </TypeButton>
            <TypeButton active={type === 'tv'} onClick={() => switchType('tv')}>
              剧集
            </TypeButton>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {tags.map((t) => (
          <button
            key={t}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs transition-colors',
              t === tag ? 'bg-accent text-on-accent' : 'bg-chip text-muted hover:text-content hover:bg-hover'
            )}
            onClick={() => setTag(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {query.isError ? (
        <p className="text-center text-sm text-faint py-8">推荐内容加载失败，可稍后重试或在设置中关闭</p>
      ) : query.isLoading ? (
        <GridSkeleton />
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-faint py-8">该分类暂无推荐内容</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {items.map((item) => (
            <DoubanCard key={item.id} item={item} onClick={() => onPick(item.title)} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Bangumi 每日放送：星期筛选，一次拉全量无分页 */
function BangumiView({ onPick }: { onPick: (title: string) => void }) {
  const [weekday, setWeekday] = useState<number | 'all'>('all');

  const query = useQuery({
    queryKey: ['bangumi-calendar'],
    queryFn: ({ signal }) => api.bangumiCalendar(signal),
  });

  let items: DoubanItem[] = [];
  if (query.data) {
    items = weekday === 'all'
      ? query.data.days.flatMap((d) => d.items)
      : (query.data.days.find((d) => d.weekday === weekday)?.items ?? []);
  }

  return (
    <section aria-label="新番放送推荐">
      <div className="flex flex-wrap gap-1.5 mb-4">
        <ChipButton active={weekday === 'all'} onClick={() => setWeekday('all')}>
          全部
        </ChipButton>
        {WEEKDAYS.map((name, i) => (
          <ChipButton key={name} active={weekday === i + 1} onClick={() => setWeekday(i + 1)}>
            {name}
          </ChipButton>
        ))}
      </div>

      {query.isError ? (
        <p className="text-center text-sm text-faint py-8">推荐内容加载失败，可稍后重试或在设置中关闭</p>
      ) : query.isLoading ? (
        <GridSkeleton />
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {items.map((item) => (
            <DoubanCard key={item.id} item={item} onClick={() => onPick(item.title)} />
          ))}
        </div>
      )}
    </section>
  );
}

const HOT_LISTS = [
  { id: 'douban_movie_weekly', label: '电影周榜' },
  { id: 'douban_tv_chinese', label: '国产剧周榜' },
  { id: 'douban_tv_global', label: '海外剧周榜' },
  { id: 'douban_show_chinese', label: '国内综艺' },
  { id: 'douban_show_global', label: '海外综艺' },
  { id: 'baidu_teleplay', label: '百度热播剧' },
];

/** 影视热榜（60s API）：豆瓣五个周榜 + 百度热播剧，chips 切换 */
function HotListView({ onPick }: { onPick: (title: string) => void }) {
  const [listId, setListId] = useState(HOT_LISTS[0].id);

  const query = useQuery({
    queryKey: ['hot-list', listId],
    queryFn: ({ signal }) => api.hotList(listId, signal),
  });

  const items = query.data?.items ?? [];

  return (
    <section aria-label="影视榜单推荐">
      <div className="flex flex-wrap gap-1.5 mb-4">
        {HOT_LISTS.map((l) => (
          <ChipButton key={l.id} active={listId === l.id} onClick={() => setListId(l.id)}>
            {l.label}
          </ChipButton>
        ))}
      </div>

      {query.isError ? (
        <p className="text-center text-sm text-faint py-8">推荐内容加载失败，可稍后重试或在设置中关闭</p>
      ) : query.isLoading ? (
        <GridSkeleton />
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {items.map((item) => (
            <DoubanCard key={item.id} item={item} onClick={() => onPick(item.title)} />
          ))}
        </div>
      )}
    </section>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] rounded-lg bg-chip animate-pulse" />
          <div className="h-3 mt-2 rounded bg-chip animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        'px-2.5 py-1 rounded-full text-xs transition-colors',
        active ? 'bg-accent text-on-accent' : 'bg-chip text-muted hover:text-content hover:bg-hover'
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TypeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={cn('px-3.5 py-1.5 rounded-md text-sm transition-colors', active ? 'bg-accent text-on-accent' : 'text-muted hover:text-content')}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
