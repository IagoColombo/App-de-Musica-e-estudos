import { useEffect, useState } from 'react';
import { searchYouTube, type YouTubeResult } from './youtubeSearch';

export function YouTubeSearch({ query, onSelect }: { query: string; onSelect: (result: YouTubeResult) => void }) {
  const [items, setItems] = useState<YouTubeResult[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2 || /https?:\/\//i.test(query)) { setItems([]); setError(''); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchYouTube(query.trim(), controller.signal).then(results => { if (!controller.signal.aborted) { setItems(results); setError(results.length ? '' : 'Nenhum vídeo encontrado.'); } }).catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Busca do YouTube indisponível.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);
  if (!import.meta.env.VITE_YOUTUBE_SEARCH_URL || query.trim().length < 2 || /https?:\/\//i.test(query)) return null;
  return <section className="youtube-search-results" aria-label="Resultados do YouTube"><h2>YouTube {loading ? '· buscando…' : ''}</h2>{error && <p role="status">{error}</p>}<div>{items.map(item => <button key={item.id} onClick={() => onSelect(item)}><img src={item.thumbnail} alt=""/><span><strong>{item.title}</strong><small>{item.channel}</small></span></button>)}</div></section>;
}
