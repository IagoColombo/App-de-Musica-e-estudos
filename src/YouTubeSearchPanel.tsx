import { Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { searchYouTube, type YouTubeResult } from './youtubeSearch';

export function YouTubeSearch({ query, onSelect }: { query: string; onSelect: (result: YouTubeResult) => void }) {
  const [items, setItems] = useState<YouTubeResult[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (query.trim().length < 2 || /https?:\/\//i.test(query)) { setItems([]); setError(''); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchYouTube(query.trim(), controller.signal).then(results => { if (!controller.signal.aborted) { setItems(results); setError(results.length ? '' : 'Nenhum vídeo encontrado.'); } }).catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Busca do YouTube indisponível.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);
  if (query.trim().length < 2 || /https?:\/\//i.test(query)) return null;
  return <section className="youtube-search-results" aria-label="Resultados do YouTube">
    <h2>YouTube</h2>
    {loading && <p role="status">Buscando vídeos…</p>}
    {error && <p role="status">{error}</p>}
    {items.length > 0 && <ul className="youtube-result-list">
      {items.map(item => <li key={item.id}>
        <button type="button" onClick={() => onSelect(item)}>
          <img src={item.thumbnail} alt="" loading="lazy"/>
          <span className="youtube-result-copy">
            <strong title={item.title}>{item.title}</strong>
            <small>{item.channel}</small>
          </span>
          <Play className="youtube-result-play" size={16} aria-hidden="true"/>
        </button>
      </li>)}
    </ul>}
  </section>;
}
