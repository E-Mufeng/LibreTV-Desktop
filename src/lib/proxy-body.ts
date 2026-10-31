/** Forward with backpressure; bound idle network reads, not the movie's total duration. */
export function withReadIdleTimeout(
  body: ReadableStream<Uint8Array>,
  idleMs: number,
  abortUpstream: (reason: unknown) => void,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let ended = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (ended) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new DOMException('源站数据等待超时', 'TimeoutError')), idleMs);
          }),
        ]);
        if (ended) return;
        if (result.done) { ended = true; controller.close(); }
        else controller.enqueue(result.value);
      } catch (error) {
        if (!ended) {
          ended = true;
          controller.error(error);
          abortUpstream(error);
          // Error the downstream first; a broken upstream cancel must not delay it.
          void reader.cancel(error).catch(() => {});
        }
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
    async cancel(reason) {
      ended = true;
      abortUpstream(reason);
      try { await reader.cancel(reason); } catch { /* Already aborted by fetch. */ }
    },
  });
}

/** Playlists are buffered for rewriting, so enforce an explicit byte ceiling. */
export async function readBoundedText(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) throw new Error('播放列表超过大小限制');
      parts.push(decoder.decode(chunk.value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join('');
  } catch (error) {
    void reader.cancel(error).catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}
