'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { mediaId, findLibraryEntry, toggleLibrary, type MediaIdentity, type LibraryFlag } from '@/lib/personal-library';
import { useToast } from './toast';
import { cn } from '@/lib/utils';

export function MediaActions({ media, compact = false }: { media: MediaIdentity; compact?: boolean }) {
  const entry = useLiveQuery(() => findLibraryEntry(media), [mediaId(media)]);
  const { toast } = useToast();
  const actions: [LibraryFlag, string, string][] = [['saved', '☆', '收藏待看'], ['liked', '♡', '喜欢'], ['watched', '✓', '看过']];
  return <details className="text-xs" aria-label={`${media.title} 个人标记`}>
    <summary className="cursor-pointer text-faint hover:text-content list-none py-1" title="收藏、喜欢、看过">{compact ? '···' : '收藏与标记 ···'}</summary>
    <div className="flex flex-wrap gap-1 mt-1">
    {actions.map(([flag, symbol, label]) => <button key={flag} type="button" aria-pressed={Boolean(entry?.[flag])} aria-label={`${entry?.[flag] ? '取消' : ''}${label}：${media.title}`} title={label}
      className={cn('rounded-md px-2 py-1.5 text-xs border transition-colors', entry?.[flag] ? 'bg-accent/15 text-accent border-accent/30' : 'bg-surface text-muted border-line hover:text-content')}
      onClick={(event) => { event.stopPropagation(); void toggleLibrary(media, flag).then((active) => toast(`${active ? '已标记' : '已取消'}${label}`, 'success')).catch((error: Error) => toast(`保存失败：${error.message}`, 'error')); }}>
      <span aria-hidden>{symbol}</span>{!compact && <span className="ml-1">{entry?.[flag] ? `已${label === '看过' ? '看过' : label === '喜欢' ? '喜欢' : '收藏'}` : label}</span>}
    </button>)}
    </div>
  </details>;
}
