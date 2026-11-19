export type YouTubeResult = { id: string; title: string; channel: string; thumbnail: string };

export async function searchYouTube(query: string, signal: AbortSignal): Promise<YouTubeResult[]> {
  const base = import.meta.env.VITE_YOUTUBE_SEARCH_URL?.trim();
  if (!base) return [];
  const url = new URL('/search', base);
  url.searchParams.set('q', query);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('A busca do YouTube está indisponível.');
  const data = await response.json() as { items?: YouTubeResult[] };
  return Array.isArray(data.items) ? data.items : [];
}
