'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from './drawer';
import { HistoryPanel } from './history-panel';
import { appShortcut } from '@/lib/shortcuts';

export function ClientShortcuts() {
  const router = useRouter();
  const [help, setHelp] = useState(false);
  const [history, setHistory] = useState(false);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const editing = Boolean(target?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
      if (document.querySelector('[aria-modal="true"]')) return;
      const action = appShortcut(event, editing);
      if (!action) return;
      event.preventDefault();
      if (action === 'history') setHistory(true);
      else if (action === 'library') router.push('/library');
      else if (action === 'help') setHelp(true);
      else {
        const input = document.querySelector<HTMLInputElement>('input[aria-label="搜索影片"], input[aria-label="搜索视频"]');
        if (input && input.getClientRects().length) input.focus();
        else router.push('/?focus=search');
      }
    };
    const showHelp = () => setHelp(true);
    window.addEventListener('keydown', handle);
    window.addEventListener('libretv:shortcut-help', showHelp);
    return () => { window.removeEventListener('keydown', handle); window.removeEventListener('libretv:shortcut-help', showHelp); };
  }, [router]);
  return <>
    <HistoryPanel open={history} onClose={() => setHistory(false)} />
    <Drawer title="快捷键与使用帮助" open={help} onClose={() => setHelp(false)}>
      <dl className="space-y-3 p-4 text-sm">{[
        ['Ctrl / ⌘ + K 或 /', '聚焦搜索'], ['Ctrl / ⌘ + Shift + L', '我的片库'], ['Ctrl / ⌘ + Shift + H', '观看历史'], ['?', '打开快捷键帮助'],
        ['空格', '播放 / 暂停'], ['← / →', '快退 / 快进 5 秒'], ['↑ / ↓', '调整音量'], ['F', '播放器全屏'], ['M', '静音'], ['Alt + ← / →', '上一集 / 下一集'], ['Esc', '关闭当前面板 / 退出全屏'],
      ].map(([key, label]) => <div className="flex justify-between gap-4 border-b border-line pb-2" key={key}><dt><kbd className="text-accent">{key}</kbd></dt><dd className="text-muted">{label}</dd></div>)}</dl>
      <p className="px-4 text-xs text-faint">输入文字或打开模态面板时不抢占应用快捷键。收藏、喜欢、看过和观看历史保存在当前设备；可在设置中导出备份。</p>
    </Drawer>
  </>;
}
