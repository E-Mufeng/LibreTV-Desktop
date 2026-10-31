/** Native file playback must not be fed to the HLS manifest parser. */
export function isNativeVideo(url: string, depth = 0): boolean {
  try {
    const parsed = new URL(url, 'http://localhost');
    if (depth < 3 && parsed.pathname === '/api/proxy' && parsed.searchParams.has('url')) return isNativeVideo(parsed.searchParams.get('url')!, depth + 1);
    return /\.(mp4|m4v|webm)$/i.test(parsed.pathname);
  } catch { return false; }
}
