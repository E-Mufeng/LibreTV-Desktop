import { afterEach, expect, it, vi } from 'vitest';
import { readBoundedText, withReadIdleTimeout } from './proxy-body';
afterEach(() => vi.useRealTimers());

it('times out a stalled network read and aborts upstream', async () => {
  vi.useFakeTimers();
  const abort = vi.fn();
  const stream = withReadIdleTimeout(new ReadableStream<Uint8Array>(), 1000, abort);
  const outcome = stream.getReader().read().then(() => null, (error: Error) => error);
  await vi.advanceTimersByTimeAsync(1001);
  expect(await outcome).toMatchObject({ name: 'TimeoutError' });
  expect(abort).toHaveBeenCalledOnce();
});
it('resets the idle deadline on each read rather than imposing a total duration', async () => {
  vi.useFakeTimers();
  let source!: ReadableStreamDefaultController<Uint8Array>;
  const abort = vi.fn();
  const stream = withReadIdleTimeout(new ReadableStream({ start(controller) { source = controller; } }), 1000, abort);
  const reader = stream.getReader();
  for (let index = 0; index < 4; index++) {
    const pending = reader.read();
    await vi.advanceTimersByTimeAsync(800);
    source.enqueue(new Uint8Array([index]));
    expect((await pending).value).toEqual(new Uint8Array([index]));
  }
  source.close(); expect((await reader.read()).done).toBe(true);
  expect(abort).not.toHaveBeenCalled();
});
it('bounds playlist memory and cancels oversized responses', async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(20)); }, cancel });
  await expect(readBoundedText(stream, 10)).rejects.toThrow('大小限制');
  expect(cancel).toHaveBeenCalled();
});
it('decodes UTF8 correctly across chunk boundaries', async () => {
  const bytes = new TextEncoder().encode('#EXTM3U\n中文');
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes.subarray(0, 10)); controller.enqueue(bytes.subarray(10)); controller.close(); } });
  expect(await readBoundedText(stream, 100)).toBe('#EXTM3U\n中文');
});
