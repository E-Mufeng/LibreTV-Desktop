import { NextResponse } from 'next/server';
import { guardRequest } from '@/lib/api-guard';
import { fetchDiscover, parseDiscoverQuery } from '@/lib/discover';

export const runtime = 'nodejs';
export async function GET(req: Request) {
  const guarded = guardRequest(req);
  if (guarded) return guarded;
  let query;
  try { query = parseDiscoverQuery(new URL(req.url).searchParams); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  try { return NextResponse.json(await fetchDiscover(query)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '分类目录加载失败' }, { status: 502 }); }
}
