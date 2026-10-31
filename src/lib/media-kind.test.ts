import { expect, it } from 'vitest';
import { isNativeVideo } from './media-kind';
it('dispatches native video files separately from HLS even through the existing proxy', () => {
  expect(isNativeVideo('https://archive.org/download/movie/video.mp4')).toBe(true);
  expect(isNativeVideo('/api/proxy?url=' + encodeURIComponent('https://example.com/movie.webm?token=x'))).toBe(true);
  expect(isNativeVideo('https://example.com/movie.MP4?token=x')).toBe(true);
  expect(isNativeVideo('https://example.com/index.m3u8')).toBe(false);
  expect(isNativeVideo('/api/proxy?url=' + encodeURIComponent('https://example.com/index.m3u8'))).toBe(false);
  expect(isNativeVideo('not a url')).toBe(false);
});
