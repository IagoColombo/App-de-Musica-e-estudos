import { useEffect, useRef, useState } from 'react';
import { connectSpotify, getSpotifyTrack, type SpotifySession, type SpotifyTrack } from './spotify';

export function SpotifyPanel() {
  const [clientId, setClientId] = useState(() => localStorage.getItem('lyra:spotifyClientId') || '');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [error, setError] = useState('');
  const session = useRef<SpotifySession | null>(null);
  const checking = useRef(false);

  useEffect(() => { localStorage.setItem('lyra:spotifyClientId', clientId.trim()); }, [clientId]);

  async function refresh() {
    if (!session.current || checking.current) return;
    checking.current = true;
    const previous = session.current;
    try {
      const result = await getSpotifyTrack(previous);
      if (session.current === previous) {
        session.current = result.session;
        setTrack(result.track);
        setError('');
      }
    } catch (cause) {
      if (session.current === previous) setError(cause instanceof Error ? cause.message : String(cause));
    } finally { checking.current = false; }
  }

  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(timer);
  }, [connected]);

  async function connect() {
    setBusy(true);
    setError('');
    try {
      session.current = await connectSpotify(clientId.trim());
      setConnected(true);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  function disconnect() {
    session.current = null;
    setConnected(false);
    setTrack(null);
    setError('');
  }

  return <div className="spotify-card">
    <div className="spotify-heading"><h3>Spotify</h3><span className={connected ? 'connected' : ''}>{connected ? 'Conectado' : 'Desconectado'}</span></div>
    {!connected ? <><p>Autorize a leitura da faixa em reprodução na sua conta.</p><label>Client ID<input value={clientId} onChange={event => setClientId(event.target.value)} placeholder="Client ID do Spotify for Developers" autoComplete="off"/></label><button className="spotify-action" disabled={busy} onClick={connect}>{busy ? 'Aguardando autorização…' : 'Conectar Spotify'}</button></> : <>
      {track ? <div className="spotify-track">{track.image && <img src={track.image} alt="Capa do álbum"/>}<div><strong>{track.title}</strong><span>{track.artist}</span><small>{track.isPlaying ? 'Em reprodução' : 'Pausada'} · {track.album}</small><a href={track.url} target="_blank" rel="noopener noreferrer">Abrir no Spotify ↗</a></div></div> : <p>Nenhuma faixa em reprodução foi encontrada.</p>}
      <div className="spotify-actions"><button onClick={refresh}>Atualizar</button><button onClick={disconnect}>Desconectar</button></div>
    </>}
    {error && <small className="spotify-error" role="alert">{error}</small>}
    <small className="spotify-footnote">A letra exibida ao lado continua sendo a prévia local.</small>
  </div>;
}
