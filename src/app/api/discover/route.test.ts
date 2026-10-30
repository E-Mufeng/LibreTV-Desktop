import { beforeEach, expect, it, vi } from 'vitest';
import { GET } from './route';
import { guardRequest } from '@/lib/api-guard';
import { fetchDiscover } from '@/lib/discover';
vi.mock('@/lib/api-guard', () => ({ guardRequest: vi.fn(() => null) }));
vi.mock('@/lib/discover', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/discover')>(), fetchDiscover: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it('未登录请求不访问外部目录', async () => {
  vi.mocked(guardRequest).mockReturnValue(new Response('login', { status: 401 }) as ReturnType<typeof guardRequest>);
  expect((await GET(new Request('https://local.test/api/discover'))).status).toBe(401);
  expect(fetchDiscover).not.toHaveBeenCalled();
});
it('不接受任意筛选值或上游目标', async () => {
  expect((await GET(new Request('https://local.test/api/discover?genre=bad'))).status).toBe(400);
  expect(fetchDiscover).not.toHaveBeenCalled();
});
it('正常组合查询和上游失败分别返回200与502', async () => {
  vi.mocked(fetchDiscover).mockResolvedValue({ items: [], hasMore: false });
  expect((await GET(new Request('https://local.test/api/discover?genre='+encodeURIComponent('喜剧')))).status).toBe(200);
  vi.mocked(fetchDiscover).mockRejectedValue(new Error('upstream failed'));
  expect((await GET(new Request('https://local.test/api/discover'))).status).toBe(502);
});
