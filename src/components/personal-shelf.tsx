'use client';

import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, type HistoryEntry } from '@/lib/db';
import { personalDb, type LibraryEntry } from '@/lib/personal-library';
import { buildWatchUrl, formatTime, formatRelativeTime } from '@/lib/utils';
import { MediaActions } from './media-actions';
import { SmartImage } from './smart-image';
import { useAppStore } from '@/lib/store';

export function HistoryTile({ item }: { item: HistoryEntry }) {
  const href = buildWatchUrl({ sourceKey: item.sourceKey, sourceUrl: item.sourceUrl, vodId: item.vodId, index: item.episodeIndex, title: item.title });
  const percent = item.duration > 0 ? Math.min(100, Math.max(0, item.playbackPosition / item.duration * 100)) : 0;
  return <article className="rounded-xl border border-line bg-surface-raised p-3">
    <Link className="flex gap-3 hover:text-accent" href={href}>
      <Poster title={item.title} pic={item.pic} />
      <div className="min-w-0 flex-1"><h3 className="font-medium line-clamp-2">{item.title}</h3>
        <p className="text-xs text-muted mt-2">第 {item.episodeIndex + 1} 集 · {formatTime(item.playbackPosition)}{item.duration > 0 && ` / ${formatTime(item.duration)}`}</p>
        <p className="text-xs text-faint mt-1">{formatRelativeTime(item.timestamp)}</p>
        <div className="h-1 bg-hover rounded mt-3 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${percent}%` }} /></div>
        <span className="text-xs text-accent inline-block mt-2">继续播放 →</span>
      </div>
    </Link>
    <div className="mt-3"><MediaActions media={{ title: item.title, pic: item.pic, sourceKey: item.sourceKey, sourceUrl: item.sourceUrl, vodId: item.vodId }} compact /></div>
  </article>;
}

function Poster({ title, pic }: { title: string; pic?: string }) {
  const mode = useAppStore((s) => s.imageProxyMode);
  const proxy = useAppStore((s) => s.customImageProxy);
  return <div className="w-16 h-24 bg-chip rounded-lg shrink-0 overflow-hidden">{pic ? <SmartImage url={pic} alt={title} mode={mode} customProxy={proxy} className="w-full h-full object-cover" /> : <span className="flex h-full items-center justify-center text-2xl text-faint">▶</span>}</div>;
}

function SavedTile({ item }: { item: LibraryEntry }) {
  const href = item.sourceKey && item.vodId ? buildWatchUrl({ sourceKey: item.sourceKey, sourceUrl: item.sourceUrl, vodId: item.vodId, title: item.title }) : `/?s=${encodeURIComponent(item.title)}`;
  return <article className="rounded-xl border border-line bg-surface-raised p-3">
    <Link className="flex gap-3 hover:text-accent" href={href}><Poster title={item.title} pic={item.pic} /><div className="min-w-0"><h3 className="font-medium line-clamp-2">{item.title}</h3><p className="text-xs text-faint mt-2">{item.year || '年份未标注'}</p><p className="text-xs text-accent mt-2">{item.sourceKey ? '打开影片' : '搜索可用片源'} →</p></div></Link>
    <div className="mt-3"><MediaActions media={item} /></div>
  </article>;
}

export function PersonalShelf() {
  const recent = useLiveQuery(() => db.history.orderBy('timestamp').reverse().limit(24).toArray());
  const counts = useLiveQuery(async () => { const all = await personalDb.media.toArray(); return { saved: all.filter((item) => item.saved).length, liked: all.filter((item) => item.liked).length }; });
  const continuing = recent?.filter((item) => item.playbackPosition > 0 && (!item.duration || item.playbackPosition < item.duration * .95)).slice(0, 4) ?? [];
  return <section className="mb-8 space-y-4" aria-label="我的观影空间">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[['我的收藏', counts?.saved ?? 0, '/library?tab=saved'], ['我的喜欢', counts?.liked ?? 0, '/library?tab=liked'], ['观看记录', recent?.length ? '继续上次' : '查看记录', '/library?tab=history'], ['看过的影片', '个人片库', '/library?tab=watched']].map(([label, value, href]) => <Link key={label} href={String(href)} className="rounded-xl border border-line bg-surface-raised hover:bg-hover p-4"><p className="text-sm text-muted">{label}</p><p className="font-semibold text-content mt-2">{value}<span className="float-right text-accent">→</span></p></Link>)}</div>
    {continuing.length > 0 && <><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">继续观看</h2><Link href="/library?tab=history" className="text-sm text-accent">全部记录 →</Link></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{continuing.map((item) => <HistoryTile item={item} key={item.id} />)}</div></>}
  </section>;
}

export function LibraryContent({ initialTab }: { initialTab: string }) {
  const [tab, setTab] = useState(initialTab);
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState('recent');
  const [visible, setVisible] = useState(36);
  const media = useLiveQuery(() => personalDb.media.orderBy('updatedAt').reverse().toArray());
  const history = useLiveQuery(() => db.history.orderBy('timestamp').reverse().toArray());
  const all = tab === 'history' ? history : media?.filter((item) => item[tab as 'saved' | 'liked' | 'watched']);
  const filtered = all?.filter((item) => item.title.toLocaleLowerCase().includes(keyword.trim().toLocaleLowerCase()));
  if (sort === 'title') filtered?.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
  const tabs = [['saved', '收藏待看'], ['liked', '我的喜欢'], ['history', '观看记录'], ['watched', '已经看过']];
  return <>
    <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label="片库分类">{tabs.map(([value, label]) => <button className={tab === value ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'} role="tab" aria-selected={tab === value} key={value} onClick={() => { setTab(value); setVisible(36); }}>{label} <span className="opacity-60">{value === 'history' ? history?.length ?? 0 : media?.filter((item) => item[value as 'saved' | 'liked' | 'watched']).length ?? 0}</span></button>)}</div>
    <div className="flex gap-3 mb-5"><input className="input flex-1 min-w-0" aria-label="搜索我的片库" placeholder="按片名查找收藏与记录…" value={keyword} onChange={(event) => { setKeyword(event.target.value); setVisible(36); }} /><select className="input" aria-label="片库排序" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">最近更新</option><option value="title">片名排序</option></select></div>
    {!all ? <p className="text-muted">正在读取本机片库…</p> : filtered?.length ? <><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.slice(0, visible).map((item) => 'timestamp' in item ? <HistoryTile item={item} key={item.id} /> : <SavedTile item={item} key={item.id} />)}</div>{filtered.length > visible && <button className="btn-ghost mt-5" onClick={() => setVisible((count) => count + 36)}>加载更多</button>}</> : <div className="text-center py-16 border border-dashed border-line rounded-xl"><h2 className="text-lg mb-2">{keyword ? '没有匹配的影片' : '这里还没有影片'}</h2><p className="text-muted text-sm">在分类海报、影片详情或播放页点击收藏、喜欢、看过；播放后会自动保存观看记录。</p><Link href="/" className="btn-primary mt-5 inline-flex">去发现影片</Link></div>}
  </>;
}
