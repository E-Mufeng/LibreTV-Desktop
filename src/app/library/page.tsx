'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { LibraryContent } from '@/components/personal-shelf';

function LibraryPageContent() {
  const params = useSearchParams();
  const tab = params.get('tab') || 'saved';
  const valid = ['saved', 'liked', 'history', 'watched'].includes(tab) ? tab : 'saved';
  return <div className="min-h-screen"><Header showSearch /><main className="max-w-6xl mx-auto p-4 sm:p-6"><div className="mb-6"><p className="text-xs tracking-widest text-accent mb-2">PERSONAL LIBRARY</p><h1 className="text-3xl font-bold">我的片库</h1><p className="text-sm text-muted mt-2">收藏待看、喜欢、看过与观看进度，一处管理。</p></div><LibraryContent key={valid} initialTab={valid} /></main></div>;
}
export default function LibraryPage() { return <Suspense><LibraryPageContent /></Suspense>; }
