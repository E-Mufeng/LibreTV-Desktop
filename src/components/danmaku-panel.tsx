'use client';

import { useEffect, useState } from 'react';
import { personalDb } from '@/lib/personal-library';
import { MAX_DANMAKU_BYTES, offsetDanmaku, parseDanmakuFile, type DanmakuRow } from '@/lib/danmaku';
import type { PlayerSkipApi } from './player-shell';

export function DanmakuPanel({ episodeKey, player }: { episodeKey: string; player: () => PlayerSkipApi | null }) {
  const [rows, setRows] = useState<DanmakuRow[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void personalDb.danmaku.get(episodeKey).then((entry) => {
      if (active) setRows(entry?.rows ?? []);
    }).catch((reason: Error) => { if (active) setError(`读取弹幕失败：${reason.message}`); });
    return () => { active = false; };
  }, [episodeKey]);
  // Player creation precedes this effect; URL changes clear the plugin before this remount.
  useEffect(() => { void player()?.loadDanmaku(offsetDanmaku(enabled ? rows : [], offset)).catch((reason: Error) => setError(`加载弹幕失败：${reason.message}`)); }, [rows, enabled, offset, player]);
  return <details className="border border-line rounded-xl p-3 mt-4 bg-surface-raised">
    <summary className="cursor-pointer text-sm font-medium">弹幕 · {rows.length ? `${rows.length} 条本地弹幕` : '导入本地弹幕文件'}</summary>
    <div className="pt-3 space-y-3 text-sm">
      <p className="text-xs text-muted">支持 JSON 数组和 Bilibili 格式 XML，按当前片源 / 剧集保存。尚未接入公共弹幕服务，不会自动获取其他网站的弹幕。</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-ghost btn-sm cursor-pointer">{busy ? '正在导入…' : '导入 JSON / XML'}<input type="file" accept=".json,.xml" className="sr-only" disabled={busy} aria-label="导入弹幕文件" onChange={async (event) => {
          const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
          setError(''); setBusy(true);
          try {
            if (file.size > MAX_DANMAKU_BYTES) throw new Error('文件超过 2 MiB');
            const parsed = parseDanmakuFile(await file.text(), file.name);
            await personalDb.transaction('rw', personalDb.danmaku, async () => {
              await personalDb.danmaku.put({ id: episodeKey, rows: parsed, updatedAt: Date.now() });
              const surplus = await personalDb.danmaku.count() - 50;
              if (surplus > 0) await personalDb.danmaku.bulkDelete((await personalDb.danmaku.orderBy('updatedAt').limit(surplus).toArray()).map((item) => item.id));
            });
            setRows(parsed); setEnabled(true);
          } catch (reason) { setError(reason instanceof Error ? reason.message : '导入失败'); }
          finally { setBusy(false); }
        }} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />显示弹幕</label>
        <label>时间偏移 <input type="number" className="input w-20 !py-1" aria-label="弹幕时间偏移秒数" min={-600} max={600} step={0.5} value={offset} onChange={(event) => setOffset(Math.max(-600, Math.min(600, Number(event.target.value) || 0)))} /> 秒</label>
        <button className="btn-ghost btn-sm" disabled={!rows.length} onClick={() => { void personalDb.danmaku.delete(episodeKey).then(() => setRows([])).catch((reason: Error) => setError(reason.message)); }}>移除本集弹幕</button>
      </div>
      {error && <p role="alert" className="text-danger text-xs">{error}</p>}
      <p className="text-xs text-faint">文件上限 2 MiB / 10000 条，最近 50 集保留。JSON 示例：[{`{"time":12.5,"text":"这一幕很精彩","mode":0,"color":"#ffffff"}`}]。偏移为正数时延后显示。</p>
    </div>
  </details>;
}
