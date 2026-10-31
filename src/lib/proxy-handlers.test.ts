import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleProxyRequest } from './proxy-handlers';
import { fetchWithSafeRedirects } from './fetch-utils';

vi.mock('./api-guard', () => ({ guardRequest: vi.fn(() => null), jsonError: (error: string, status: number) => Response.json({ error }, { status }) }));
vi.mock('./ssrf', () => ({ isValidProxyUrl: vi.fn(() => true), isBlockedByDNS: vi.fn(() => false), checkLiveUrlAllowed: vi.fn() }));
vi.mock('./fetch-utils', () => ({ fetchWithSafeRedirects: vi.fn() }));
const target = 'https://media.example.com/movie.mp4';
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe('VOD proxy streaming lifetime', () => {
  it('keeps a progressing media body alive beyond the old 8-second deadline', async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms);
      return controller.signal;
    });
    let source!: ReadableStreamDefaultController<Uint8Array>;
    vi.mocked(fetchWithSafeRedirects).mockImplementationOnce(async (_url, init = {}) => ({
      res: new Response(new ReadableStream<Uint8Array>({ start(controller) {
        source = controller;
        init.signal?.addEventListener('abort', () => controller.error(init.signal?.reason), { once: true });
      } }), { headers: { 'content-type': 'video/mp4' } }), finalUrl: target,
    }));
    const response = await handleProxyRequest(new Request('http://localhost/api/proxy'), target);
    const reader = response.body!.getReader();
    source.enqueue(new Uint8Array([1]));
    expect((await reader.read()).value).toEqual(new Uint8Array([1]));
    await vi.advanceTimersByTimeAsync(9000);
    source.enqueue(new Uint8Array([2]));
    expect((await reader.read()).value).toEqual(new Uint8Array([2]));
    source.close(); await reader.read();
    expect(vi.mocked(fetchWithSafeRedirects).mock.calls[0][2]).toMatchObject({ headerTimeoutMs: 8000 });
  });

  it('aborts the upstream when the downstream cancels and preserves Range headers', async () => {
    let signal: AbortSignal | null | undefined;
    const cancel = vi.fn();
    vi.mocked(fetchWithSafeRedirects).mockImplementationOnce(async (_url, init = {}) => {
      signal = init.signal;
      return { res: new Response(new ReadableStream({ cancel }), { status: 206, headers: { 'content-type': 'video/mp4', 'content-range': 'bytes 0-9/100', 'accept-ranges': 'bytes' } }), finalUrl: target };
    });
    const response = await handleProxyRequest(new Request('http://localhost/api/proxy', { headers: { range: 'bytes=0-9' } }), target);
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-9/100');
    expect(vi.mocked(fetchWithSafeRedirects).mock.calls[0][1]?.headers).toMatchObject({ Range: 'bytes=0-9' });
    await response.body!.cancel('client closed');
    expect(signal?.aborted).toBe(true);
    expect(cancel).toHaveBeenCalled();
  });

  it('rewrites signed HLS playlists even when the server labels them octet-stream', async () => {
    vi.mocked(fetchWithSafeRedirects).mockResolvedValueOnce({ res: new Response('#EXTM3U\n#EXTINF:4,\nsegment.ts\n', { headers: { 'content-type': 'application/octet-stream' } }), finalUrl: 'https://media.example.com/hls/index.m3u8?token=x' });
    const response = await handleProxyRequest(new Request('http://localhost/api/proxy'), 'https://media.example.com/hls/index.m3u8?token=x');
    expect(await response.text()).toContain('/api/proxy?url=');
  });
});
